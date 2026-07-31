// ============================================
// INICIALIZAÇÃO DO MAPA
// ============================================
const mapa = L.map('map').setView([-24.0465, -52.3789], 9);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19
}).addTo(mapa);

// Salva a visão original do mapa para restaurar ao limpar pesquisa
const visaoOriginal = {
    center: mapa.getCenter(),
    zoom: mapa.getZoom()
};

// ============================================
// LINK DA API
// ============================================
const API = "https://script.google.com/macros/s/AKfycbyTWlSeFR1AYvUYNcVZ7j0YXxpn_UHHK9UnJ2AtQZAgXReEfRr6fqgEO3SX7jM-A5cVmQ/exec";

// ============================================
// VARIÁVEIS GLOBAIS
// ============================================
let todosMarcadores = [];    // Array com todos os objetos { marker, dados }
let dadosCompletos = [];     // Array com os dados brutos da API

// Elementos do DOM
const inputBusca = document.getElementById('buscar');
const contadorResultados = document.getElementById('contador-resultados');

// ============================================
// CORES PERSONALIZADAS PARA OS MARCADORES
// ============================================
function criarIconePersonalizado(cor = '#1b5e20') {
    return L.divIcon({
        className: 'marcador-personalizado',
        html: `<div style="
            background: ${cor};
            width: 28px;
            height: 28px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid #fff;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
        ">
            <span style="
                transform: rotate(45deg);
                font-size: 14px;
                color: #fff;
                font-weight: bold;
            ">📍</span>
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -30]
    });
}

// ============================================
// GERAR HTML DO POPUP COM BOTÕES DE NAVEGAÇÃO
// ============================================
function gerarPopupHTML(dados) {
    const lat = Number(dados.latitude);
    const lng = Number(dados.longitude);
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    const wazeUrl = `https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes`;

    return `
        <div class="popup-cooperativa">
            <div class="popup-header">
                <span class="popup-icone">👤</span>
                <strong class="popup-nome">${dados.cooperado}</strong>
            </div>
            <div class="popup-info">
                <div class="popup-linha">
                    <span class="popup-label">🐄 Fazenda:</span>
                    <span class="popup-valor">${dados.fazenda}</span>
                </div>
                <div class="popup-linha">
                    <span class="popup-label">📍 Município:</span>
                    <span class="popup-valor">${dados.municipio}</span>
                </div>
            </div>
            <div class="popup-acoes">
                <a href="${googleMapsUrl}" target="_blank" class="btn-navegacao btn-google">
                    <span class="btn-icone">🗺️</span> Google Maps
                </a>
                <a href="${wazeUrl}" target="_blank" class="btn-navegacao btn-waze">
                    <span class="btn-icone">🧭</span> Waze
                </a>
            </div>
        </div>
    `;
}

// ============================================
// FUNÇÃO DE PESQUISA / FILTRO
// ============================================
function filtrarPorTexto(texto) {
    if (!texto || texto.trim() === '') {
        // Mostra todos os marcadores
        todosMarcadores.forEach(item => {
            if (!mapa.hasLayer(item.marker)) {
                mapa.addLayer(item.marker);
            }
        });
        // Restaura visão original do mapa
        mapa.setView(visaoOriginal.center, visaoOriginal.zoom, { animate: true });
        if (contadorResultados) {
            contadorResultados.textContent = `📌 ${todosMarcadores.length} cooperado(s) encontrado(s)`;
            contadorResultados.className = 'contador-resultados visivel';
        }
        return;
    }

    const termo = texto.toLowerCase().trim();
    let encontrados = [];
    let bounds = L.latLngBounds();

    todosMarcadores.forEach(item => {
        const dados = item.dados;
        const nome = (dados.cooperado || '').toLowerCase();
        const fazenda = (dados.fazenda || '').toLowerCase();
        const municipio = (dados.municipio || '').toLowerCase();

        const corresponde = nome.includes(termo) || fazenda.includes(termo) || municipio.includes(termo);

        if (corresponde) {
            if (!mapa.hasLayer(item.marker)) {
                mapa.addLayer(item.marker);
            }
            encontrados.push(item);
            bounds.extend(item.marker.getLatLng());
        } else {
            if (mapa.hasLayer(item.marker)) {
                mapa.removeLayer(item.marker);
            }
        }
    });

    // Aplica zoom baseado na quantidade de resultados
    if (encontrados.length === 1) {
        // 1 resultado: zoom no cooperado e abre popup
        const marker = encontrados[0].marker;
        const latlng = marker.getLatLng();
        mapa.setView(latlng, 16, { animate: true });
        marker.openPopup();
    } else if (encontrados.length > 1) {
        // Múltiplos resultados: ajusta zoom para mostrar todos
        mapa.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }

    // Atualiza contador
    if (contadorResultados) {
        if (encontrados.length === 0) {
            contadorResultados.textContent = '😕 Nenhum resultado encontrado';
            contadorResultados.className = 'contador-resultados visivel nenhum';
        } else {
            contadorResultados.textContent = `📌 ${encontrados.length} cooperado(s) encontrado(s)`;
            contadorResultados.className = 'contador-resultados visivel';
        }
    }
}

// ============================================
// CARREGAR DADOS DA API
// ============================================
fetch(API)
.then(res => res.json())
.then(cooperados => {

    if (!Array.isArray(cooperados) || cooperados.length === 0) {
        console.warn('Nenhum dado encontrado na API.');
        if (contadorResultados) {
            contadorResultados.textContent = '⚠️ Nenhum cooperado encontrado.';
            contadorResultados.className = 'contador-resultados visivel nenhum';
        }
        return;
    }

    dadosCompletos = cooperados;
    console.log(`📦 ${cooperados.length} cooperados carregados:`, cooperados);

    cooperados.forEach((item, index) => {
        const lat = Number(item.latitude);
        const lng = Number(item.longitude);

        if (isNaN(lat) || isNaN(lng)) {
            console.warn(`⚠️ Coordenadas inválidas para ${item.cooperado}:`, item);
            return;
        }

        // Alterna cores para dar variedade visual
        const cores = ['#1b5e20', '#2e7d32', '#388e3c', '#43a047', '#4caf50', '#2e7d32', '#1b5e20'];
        const cor = cores[index % cores.length];

        const marker = L.marker([lat, lng], {
            icon: criarIconePersonalizado(cor)
        }).addTo(mapa);

        marker.bindPopup(gerarPopupHTML(item), {
            maxWidth: 320,
            minWidth: 280,
            className: 'popup-estilizado'
        });

        todosMarcadores.push({
            marker: marker,
            dados: item
        });
    });

    console.log(`✅ ${todosMarcadores.length} marcadores adicionados ao mapa.`);

    // Atualiza contador inicial
    if (contadorResultados) {
        contadorResultados.textContent = `📌 ${todosMarcadores.length} cooperado(s) encontrado(s)`;
        contadorResultados.className = 'contador-resultados visivel';
    }

})
.catch(err => {
    console.error('❌ Erro ao carregar dados:', err);
    if (contadorResultados) {
        contadorResultados.textContent = '❌ Erro ao carregar dados. Verifique a conexão.';
        contadorResultados.className = 'contador-resultados visivel nenhum';
    }
});

// ============================================
// EVENTO DE PESQUISA (AO DIGITAR)
// ============================================
if (inputBusca) {
    inputBusca.addEventListener('input', function () {
        filtrarPorTexto(this.value);
    });

    // Foca no campo ao pressionar Ctrl+K ou /
    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey && e.key === 'k') || e.key === '/') {
            if (document.activeElement !== inputBusca) {
                e.preventDefault();
                inputBusca.focus();
            }
        }
    });
}
