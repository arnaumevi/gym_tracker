// script.js (CORREGIDO - V2)

// ==========================================
// ⚠️ PEGA AQUÍ LA URL BASE DE PUBLICACIÓN FINAL DEL GOOGLE SHEET
// ==========================================
// *** Asegúrate que aquesta línia conté la teva clau '2PACX-1vR...' ***
const BASE_URL_PUBLISHED = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRblUmox0xuv8DtJfqboC1UXQ8tOEf4aS5PmdrHabaHgOsUdVQbUWtHjKXQF6owpG2xEOU6ekkG2idk/pub"; 
// GIDs (No cambiar, son los que proporcionaste)
const URL_ARNAU = `${BASE_URL_PUBLISHED}?gid=0&single=true&output=csv`;
const URL_CAMATS = `${BASE_URL_PUBLISHED}?gid=1482168485&single=true&output=csv`;

let chartInstances = {};
let allExercises = [];

async function init() {
    // ⚠️ GUARD: Només carregar dades si estem en una pàgina d'estadístiques
    if (!document.body.classList.contains('arnau-stats') && 
        !document.body.classList.contains('camats-stats') && 
        !document.body.classList.contains('vs-stats')) {
        return; 
    }
    
    try {
        const [dataArnau, dataCamats] = await Promise.all([
            fetchData(URL_ARNAU),
            fetchData(URL_CAMATS)
        ]);
        
        // Obtenemos todos los ejercicios una vez
        if (dataArnau.length > 0) {
            allExercises = Object.keys(dataArnau[0]).slice(3);
        }

        // Ejecutar las funciones dependiendo de la página
        if (document.body.classList.contains('arnau-stats')) {
            setupIndividualPage(dataArnau, 'arnau', 'arnauChart1', 'arnauChart2', 'streak-arnau');
        } else if (document.body.classList.contains('camats-stats')) {
            setupIndividualPage(dataCamats, 'camats', 'camatsChart1', 'camatsChart2', 'streak-camats');
        } else if (document.body.classList.contains('vs-stats')) {
            setupVSPage(dataArnau, dataCamats);
        }

    } catch (error) {
        // Mostrarem l'error de forma menys invasiva per evitar bloquejos addicionals
        console.error("Error FATAL al carregar dades CSV:", error);
        const header = document.querySelector('header');
        if (header) {
             header.insertAdjacentHTML('afterend', '<p style="color:red; text-align:center; padding:10px; border:1px solid red; border-radius:5px; margin-top:15px;">❌ ERROR: No es poden carregar les dades de l\'Excel. Revisa els permisos de publicació.</p>');
        }
    }
}

// ==========================================
// LÓGICA DE CARGA DE DATOS
// ==========================================
function fetchData(url) {
    return new Promise((resolve, reject) => {
        Papa.parse(url, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (results) => resolve(results.data),
            error: (err) => reject(err)
        });
    });
}

// ==========================================
// LÓGICA DE STREAK (RACHAS)
// ==========================================
function calculateStreak(data, elementId) {
    // Código de cálculo de streak... (sin cambios)
    let weeklyCounts = {};
    
    data.forEach(row => {
        const hasData = Object.keys(row).some(key => key !== 'FECHA' && key !== 'DÍA' && key !== 'RUTINA' && String(row[key]).trim() !== "");
        if (hasData && row['FECHA']) {
            const date = new Date(row['FECHA']);
            const onejan = new Date(date.getFullYear(), 0, 1);
            const week = Math.ceil((((date.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
            const weekKey = `${date.getFullYear()}-W${week}`;
            
            if (!weeklyCounts[weekKey]) weeklyCounts[weekKey] = new Set();
            weeklyCounts[weekKey].add(row['DÍA']);
        }
    });

    let perfectWeeks = 0;
    Object.values(weeklyCounts).forEach(daysSet => {
        if (daysSet.size >= 3) {
            perfectWeeks++;
        }
    });

    if(document.getElementById(elementId)) {
        document.getElementById(elementId).innerText = perfectWeeks;
    }
}

// ==========================================
// LÓGICA DE PÁGINAS INDIVIDUALES (Arnau/Camats)
// ==========================================

function populateSelect(selectId, exercises) {
    const select = document.getElementById(selectId);
    // 🔑 Fix: Comprobar si l'element existeix abans d'usar appendChild
    if (!select) {
        // console.warn(`Select element with ID "${selectId}" not found on this page.`);
        return; 
    }
    
    exercises.forEach((ex, index) => {
        const option = document.createElement('option');
        option.value = ex;
        option.textContent = ex.replace(' (kg)', '').replace(' / ', ' - ');
        if(index === 0) option.selected = true;
        select.appendChild(option);
    });
}

function setupIndividualPage(data, name, chartId1, chartId2, streakId) {
    // 1. Calcular Streak
    calculateStreak(data, streakId);

    // 2. Configurar Gráfico de Progresión (Chart 1)
    const selectId = `exerciseSelect${name.charAt(0).toUpperCase() + name.slice(1)}`;
    const color = name === 'arnau' ? '#0ea5e9' : '#10b981';
    
    populateSelect(selectId, allExercises);

    const renderProgressionChart = (exercise) => {
        const points = data
            .map(row => {
                const peso = parseFloat(String(row[exercise]).replace(',', '.'));
                if (!peso || isNaN(peso)) return null;
                return { x: row['FECHA'], y: peso };
            })
            .filter(p => p !== null);

        drawChart(chartId1, 'line', [{
            label: `Progresión ${name}`,
            data: points,
            borderColor: color,
            backgroundColor: color,
            tension: 0.2,
            pointRadius: 5
        }], {
            title: { display: false },
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Kg Máximo' } } }
        });
    };

    const selectElement = document.getElementById(selectId);
    if (selectElement) {
        selectElement.addEventListener('change', (e) => renderProgressionChart(e.target.value));
        if (selectElement.value) {
            renderProgressionChart(selectElement.value);
        }
    }
    
    // 3. Configurar Gráfico de Volumen (Chart 2)
    renderVolumeChart(data, chartId2, color);
}

function renderVolumeChart(data, chartId, color) {
    // Calcular el volumen total (Peso * Reps * Series) para cada fila
    const volumeByDate = data
        .filter(row => row['FECHA'] && row['DÍA'])
        .map(row => {
            let totalVolume = 0;
            // SIMPLIFICACIÓN: Multiplicador ficticio para volumen total
            const multiplier = row['RUTINA'] && row['RUTINA'].includes('Body A') ? 40 : 35; 
            
            Object.keys(row).slice(3).forEach(exercise => {
                const peso = parseFloat(String(row[exercise]).replace(',', '.'));
                if (peso && !isNaN(peso)) {
                    totalVolume += peso * multiplier;
                }
            });
            return { x: row['FECHA'], y: totalVolume };
        });

    drawChart(chartId, 'bar', [{
        label: 'Volumen Total (Kg ficticios)',
        data: volumeByDate,
        backgroundColor: color + '99', 
        borderColor: color,
        borderWidth: 1
    }], {
        title: { display: false },
        scales: { 
            x: { stacked: true }, 
            y: { stacked: true, title: { display: true, text: 'Kg Totales (Est.)' } }
        }
    });
}

// ==========================================
// LÓGICA DE PÁGINA VS
// ==========================================
function setupVSPage(dataArnau, dataCamats) {
    // 1. Streaks
    calculateStreak(dataArnau, 'streak-arnau-vs');
    calculateStreak(dataCamats, 'streak-camats-vs');

    // 2. Gráfico VS (Fuerza Máxima)
    populateSelect('exerciseSelectVS', allExercises);

    const renderVSChart = (exercise) => {
        const pointsArnau = getProgressionPoints(dataArnau, exercise);
        const pointsCamats = getProgressionPoints(dataCamats, exercise);

        drawChart('vsChart', 'line', [
            { label: 'Arnau', data: pointsArnau, borderColor: '#0ea5e9', backgroundColor: '#0ea5e9', tension: 0.2, pointRadius: 5 },
            { label: 'Camats', data: pointsCamats, borderColor: '#10b981', backgroundColor: '#10b981', tension: 0.2, pointRadius: 5 }
        ], {
            title: { display: true, text: `Comparativa en ${exercise.replace(' (kg)', '')}` },
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Kg Máximo' } } }
        });
    };

    const selectElement = document.getElementById('exerciseSelectVS');
    if (selectElement) {
        selectElement.addEventListener('change', (e) => renderVSChart(e.target.value));
        if (selectElement.value) {
            renderVSChart(selectElement.value);
        }
    }
    
    // 3. Gráfico VS (Volumen Semanal)
    renderVSVolumeChart(dataArnau, dataCamats);
}

function getProgressionPoints(data, exercise) {
    return data
        .map(row => {
            const peso = parseFloat(String(row[exercise]).replace(',', '.'));
            if (!peso || isNaN(peso)) return null;
            return { x: row['FECHA'], y: peso };
        })
        .filter(p => p !== null);
}

function renderVSVolumeChart(dataArnau, dataCamats) {
    // Para el VS, agrupamos el volumen semanalmente
    const [volumeArnau, labelsArnau] = calculateWeeklyVolume(dataArnau, 'Arnau');
    const [volumeCamats, labelsCamats] = calculateWeeklyVolume(dataCamats, 'Camats');

    // Usamos las etiquetas comunes (semanas)
    const allLabels = [...new Set([...labelsArnau, ...labelsCamats])].sort().slice(-4); // Últimas 4 semanas

    const mapVolumeToLabels = (volumeData, labels) => {
        const map = new Map();
        volumeData.forEach((vol, index) => map.set(labels[index], vol));
        return allLabels.map(label => map.get(label) || 0); // Rellenar con 0 si no hay datos
    };

    const dataArnauMapped = mapVolumeToLabels(volumeArnau, labelsArnau);
    const dataCamatsMapped = mapVolumeToLabels(volumeCamats, labelsCamats);

    drawChart('vsVolumeChart', 'bar', [
        { label: 'Arnau', data: dataArnauMapped, backgroundColor: '#0ea5e999', borderColor: '#0ea5e9', borderWidth: 1 },
        { label: 'Camats', data: dataCamatsMapped, backgroundColor: '#10b98199', borderColor: '#10b981', borderWidth: 1 }
    ], {
        title: { display: false },
        scales: { 
            x: { stacked: false, type: 'category', labels: allLabels, ticks: { color: '#9ca3af', maxRotation: 45, minRotation: 45 } }, 
            y: { beginAtZero: true, title: { display: true, text: 'Kg Totales (Est.)' }, ticks: { color: '#9ca3af' } }
        }
    });
}

function calculateWeeklyVolume(data, name) {
    let weeklyVolume = {}; // { '2025-W50': 15000 }
    
    data.forEach(row => {
        if (row['FECHA'] && row['RUTINA']) {
            const date = new Date(row['FECHA']);
            const onejan = new Date(date.getFullYear(), 0, 1);
            const week = Math.ceil((((date.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
            const weekKey = `${date.getFullYear()}-W${week}`;

            // Volumen ficticio (mismo cálculo que en la página individual)
            const multiplier = row['RUTINA'] && row['RUTINA'].includes('Body A') ? 40 : 35; 
            let sessionVolume = 0;
            Object.keys(row).slice(3).forEach(exercise => {
                const peso = parseFloat(String(row[exercise]).replace(',', '.'));
                if (peso && !isNaN(peso)) {
                    sessionVolume += peso * multiplier;
                }
            });

            if (!weeklyVolume[weekKey]) weeklyVolume[weekKey] = 0;
            weeklyVolume[weekKey] += sessionVolume;
        }
    });
    
    const labels = Object.keys(weeklyVolume);
    const volumes = Object.values(weeklyVolume);
    
    return [volumes, labels];
}

// ==========================================
// FUNCIÓN GENERAL DE DIBUJO DE GRÁFICOS
// ==========================================
function drawChart(chartId, type, datasets, options) {
    const ctx = document.getElementById(chartId);
    if (!ctx) return; // FIX: Si el canvas no existe, no intentar dibujar.
    
    const ctx2D = ctx.getContext('2d');
    
    if (chartInstances[chartId]) chartInstances[chartId].destroy();

    const defaultOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: '#f9fafb' } },
            tooltip: { mode: 'index', intersect: false }
        },
        scales: {
            x: { 
                type: 'category', 
                ticks: { color: '#9ca3af', maxTicksLimit: 10 } 
            },
            y: { 
                ticks: { color: '#9ca3af' },
                grid: { color: '#33415555' } // Rejilla más suave
            }
        }
    };
    
    chartInstances[chartId] = new Chart(ctx2D, {
        type: type,
        data: { datasets: datasets },
        options: Chart.helpers.merge(defaultOptions, options)
    });
}

// Arrancar
init();
