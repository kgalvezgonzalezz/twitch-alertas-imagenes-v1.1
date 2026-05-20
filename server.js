const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const tmi = require('tmi.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { exec } = require('child_process');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const localIo = new Server(server);

// --- SISTEMA DE MEMORIA (CONFIG) ---
const CONFIG_FILE = path.join(__dirname, 'config.json');

function cargarConfiguracion() {
    if (fs.existsSync(CONFIG_FILE)) {
        return JSON.parse(fs.readFileSync(CONFIG_FILE));
    }
    return { canal: '' };
}

function guardarConfiguracion(config) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

let config = cargarConfiguracion();
let client = null;
const MIN_BITS = 100;

app.use(express.static('public'));
app.use(express.json());
app.use('/images', express.static('downloads'));

if (!fs.existsSync('./downloads')) {
    fs.mkdirSync('./downloads');
}

// --- FUNCIONES DE IMÁGENES ---
async function descargarYMostrar(imageUrl) {
    const cleanUrl = imageUrl.split('?')[0]; 
    const hashUnico = crypto.createHash('md5').update(cleanUrl).digest('hex');
    const ext = path.extname(cleanUrl) || '.png';
    const prefijo = `alerta_${hashUnico}`; 
    
    const filename = `${prefijo}_${Date.now()}${ext}`;
    const filepath = path.join(__dirname, 'downloads', filename);
    const dirDownloads = path.join(__dirname, 'downloads');

    try {
        // Limpieza de duplicados (máximo 2 archivos iguales)
        const archivosEnCarpeta = fs.readdirSync(dirDownloads);
        const duplicados = archivosEnCarpeta.filter(archivo => archivo.startsWith(prefijo));

        if (duplicados.length >= 2) {
            duplicados.sort(); 
            const cantidadABorrar = duplicados.length - 1;
            for (let i = 0; i < cantidadABorrar; i++) {
                const archivoViejo = path.join(dirDownloads, duplicados[i]);
                if (fs.existsSync(archivoViejo)) {
                    fs.unlinkSync(archivoViejo);
                    console.log(`🧹 Limpieza: Se borró versión antigua de imagen repetida.`);
                }
            }
        }

        console.log(`⬇️ Descargando imagen aprobada...`);
        const response = await axios({ url: imageUrl, responseType: 'stream' });
        
        const writer = fs.createWriteStream(filepath);
        response.data.pipe(writer);

        writer.on('finish', () => {
            console.log(`🖼️ Enviada a OBS: ${filename}`);
            localIo.emit('show_image', `/images/${filename}`);
        });
    } catch (err) {
        console.error('❌ Error al descargar la imagen.');
    }
}

async function enviarARevision(mensaje, usuario, tipo) {
    if (!mensaje) return;
    const urlRegex = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp)(?:\?[^\s]*)?)/gi;
    const matches = mensaje.match(urlRegex);

    if (matches && matches.length > 0) {
        const imageUrl = matches[0];
        let pesoTexto = "Desconocido";

        try {
            const respuestaHead = await axios.head(imageUrl);
            const bytes = respuestaHead.headers['content-length'];
            
            if (bytes) {
                // NUEVO: Definir límite estricto de 500 MB en bytes (500 * 1024 * 1024)
                const LIMITE_BYTES = 524288000; 
                
                if (parseInt(bytes, 10) > LIMITE_BYTES) {
                    const mbExcedido = (bytes / (1024 * 1024)).toFixed(2);
                    console.log(`🚫 [AUTO-RECHAZO] Enlace de ${usuario} bloqueado automáticamente. Supera los 500MB (${mbExcedido} MB)`);
                    return; // Corta la función de inmediato, el panel nunca recibirá la alerta
                }

                const mb = (bytes / (1024 * 1024)).toFixed(2); 
                pesoTexto = `${mb} MB`;
            }
        } catch (error) {
            console.log(`⚠️ No se pudo obtener el peso exacto de: ${imageUrl}`);
        }

        console.log(`👀 Imagen en cola por ${usuario} | Peso: ${pesoTexto}`);
        
        localIo.emit('nueva_revision', { 
            usuario: usuario, 
            tipo: tipo, 
            url: imageUrl,
            peso: pesoTexto
        });
    }
}

// --- CONEXIÓN DINÁMICA A TWITCH ---
function iniciarTwitch(nombreCanal) {
    if (client) client.disconnect();

    client = new tmi.Client({
        connection: { secure: true, reconnect: true },
        channels: [ nombreCanal ]
    });

    client.connect().then(() => {
        console.log(`✅ Conectado a Twitch: ${nombreCanal}`);
        localIo.emit('estado_twitch', { conectado: true, canal: nombreCanal });
    }).catch((err) => {
        console.error('❌ Error conectando a Twitch:', err);
        localIo.emit('estado_twitch', { conectado: false, canal: nombreCanal });
    });

    client.on('cheer', (channel, userstate, message) => {
        const bits = parseInt(userstate.bits, 10);
        if (bits >= MIN_BITS) enviarARevision(message, userstate.username, `Bits: ${bits}`);
    });

    client.on('resub', (channel, username, months, message, userstate, methods) => {
        enviarARevision(message, username, 'Resub');
    });

    client.on('subscription', (channel, username, method, message, userstate) => {
        enviarARevision(message, username, 'Nueva Sub');
    });

    client.on('message', (channel, userstate, message, self) => {
        if (self) return;
        if (userstate['custom-reward-id']) {
            enviarARevision(message, userstate.username, 'Puntos');
        }
    });
}

// --- ESCUCHAR AL PANEL DE ADMIN ---
localIo.on('connection', (socket) => {
    if (config.canal) {
        socket.emit('estado_twitch', { conectado: true, canal: config.canal });
    } else {
        socket.emit('estado_twitch', { conectado: false, canal: '' });
    }

    socket.on('guardar_canal', (nuevoCanal) => {
        config.canal = nuevoCanal.toLowerCase();
        guardarConfiguracion(config);
        iniciarTwitch(config.canal);
    });

    socket.on('aprobar_imagen', (url) => descargarYMostrar(url));
    socket.on('imagen_manual', (url) => descargarYMostrar(url));
});

server.listen(3000, () => {
    console.log('🚀 Servidor corriendo. Abriendo panel...');
    if (config.canal) iniciarTwitch(config.canal);
    exec('start http://localhost:3000/admin.html');
});