// script.js (CORREGIDO - V3: Mobile-First, 3 Gráficos, Volumen Semanal)

// ==========================================
// ⚠️ PEGA AQUÍ LA URL BASE DE PUBLICACIÓN FINAL DEL GOOGLE SHEET
// ==========================================
const BASE_URL_PUBLISHED = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRblUmox0xuv8DtJfqboC1UXQ8tOEf4aS5PmdrHabaHgOsUdVQbUWtHjKXQF6owpG2xEOU6ekkG2idk/pub"; 
// GIDs (No cambiar, son los que proporcionaste)
const URL_ARNAU = `${BASE_URL_PUBLISHED}?gid=0&single=true&output=csv`;
const URL_CAMATS = `${BASE_URL_PUBLISHED}?gid=1482168485&single=true&output=csv`;

let chartInstances = {};
let allExercises = [];

// ==========================================
// FUNCIÓN DE INICIO
// ==========================================
async function init() {
    const pageClass = document.body.className;
    
    // GUARD: Sólo cargar datos si estamos en una página de estadísticas
    if (!pageClass.includes('stats')) {
        return; 
    }
    
    try {
        const [dataArnau, dataCamats] = await Promise.all([
            fetchData(URL_ARNAU),
            fetchData(URL_CAMATS)
        ]);
        
        // Obtenemos todos los ejercicios una vez (basado en la primera fila de Arnau)
        if (dataArnau.length > 0) {
            allExercises = Object.keys(dataArnau[0]).slice(3);
        }

        // Ejecutar las funciones dependiendo de la página
        if (pageClass.includes('arnau-stats')) {
            setupIndividualPage(dataArnau, 'arnau', '#3b82f6'); // Azul
        } else if (pageClass.includes('camats-stats')) {
            setupIndividualPage(dataCamats, 'camats', '#10b981'); // Verde
        } else if (pageClass.includes('vs-stats')) {
            setupVSPage(dataArnau, dataCamats);
        }

    } catch (error) {
        console.error("Error FATAL al carregar dades CSV:", error);
        const app = document.querySelector('.app');
        if (app) {
             app.insertAdjacentHTML('afterbegin', '<p class="error-message">❌ ERROR: No se pueden cargar las datos. Revisa los permisos de publicación del Excel o la URL base.</p>');
        }
    }
}

// ==========================================
// LÓGICA GENERAL DE DATOS
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

function getWeekKey(dateStr) {
    const date = new Date(dateStr);
    if (isNaN(date)) return null;
    
    // Obtener el número de semana ISO 8601 (con ajuste para el día de la semana)
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);

    return `${d.getUTCFullYear()}-W${weekNo}`;
}

/**
 * Calcula el volumen total estimado para una sesión.
 * Asume 3-4 series de 8-12 reps (multiplicador fijo).
 */
function calculateSessionVolume(row) {
    let totalVolume = 0;
    // Multiplicador ficticio: Más alto para Full Body A/B, ligeramente menor para C.
    const multiplier = row['RUTINA'] && row['RUTINA'].includes('Body C') ? 35 : 40; 
    
    Object.keys(row).slice(3).forEach(exercise => {
        const peso = parseFloat(String(row[exercise]).replace(',', '.'));
        if (peso && !isNaN(peso)) {
            totalVolume += peso * multiplier;
        }
    });
    return totalVolume;
}

// ==========================================
// LÓGICA DE STREAK Y FRECUENCIA
// ==========================================
function calculateFrequency(data) {
    let weeklyCounts = {}; // { 'YYYY-Wxx': 3 }

    data.forEach(row => {
        const hasData = calculateSessionVolume(row) > 0;
        if (hasData && row['FECHA']) {
            const weekKey = getWeekKey(row['FECHA']);
            if (weekKey) {
                if (!weeklyCounts[weekKey]) weeklyCounts[weekKey] = 0;
                weeklyCounts[weekKey]++;
            }
        }
    });
    return weeklyCounts;
}

function calculateStreak(data, elementId) {
    const weeklyCounts = calculateFrequency(data);
    
    let perfectWeeks = 0;
    Object.values(weeklyCounts).forEach(count => {
        if (count >= 3) { // Consideramos 'perfecta' si hay 3 o más sesiones
            perfectWeeks++;
        }
    });

    const el = document.getElementById(elementId);
    if(el) {
        el.innerText = perfectWeeks;
    }
}

// ==========================================
// LÓGICA DE PÁGINAS INDIVIDUALES (Arnau/Camats)
// ==========================================

function populateSelect(selectId, exercises) {
    const select = document.getElementById(selectId);
    if (!select) return; // FIX: Comprobar si existe
    
    exercises.forEach((ex, index) => {
        const option = document.createElement('option');
        option.value = ex;
        option.textContent = ex.replace(' (kg)', '').replace(' / ', ' - ');
        if(index === 0) option.selected = true;
        select.appendChild(option);
    });
}

function getProgressionPoints(data, exercise) {
    return data
        .filter(row => row['FECHA'])
        .map(row => {
            const peso = parseFloat(String(row[exercise]).replace(',', '.'));
            if (!peso || isNaN(peso) || peso === 0) return null;
            return { x: row['FECHA'], y: peso };
        })
        .filter(p => p !== null);
}


function setupIndividualPage(data, name, color) {
    // 1. Calcular Streak
    calculateStreak(data, `streak-${name}`);

    // 2. Configurar Gráfico de Progresión (Chart 1)
    const selectId = `exerciseSelect${name.charAt(0).toUpperCase() + name.slice(1)}`;
    
    populateSelect(selectId, allExercises);

    const renderProgressionChart = (exercise) => {
        const points = getProgressionPoints(data, exercise);
        drawChart(`${name}Chart1`, 'line', [{
            label: `Progreso ${name}`,
            data: points,
            borderColor: color,
            backgroundColor: `${color}40`, // Transparente
            tension: 0.3,
            pointRadius: 4
        }], {
            title: { text: `Progresión de Peso en ${exercise.replace(' (kg)', '')}` },
            scales: { y: { beginAtZero: true, title: { text: 'Kg Máximo' } } }
        });
    };

    const selectElement = document.getElementById(selectId);
    if (selectElement) {
        selectElement.addEventListener('change', (e) => renderProgressionChart(e.target.value));
        if (selectElement.value) {
            renderProgressionChart(selectElement.value);
        }
    }
    
    // 3. Configurar Gráfico de Volumen Diario (Chart 2)
    const volumeByDate = data
        .filter(row => row['FECHA'] && row['RUTINA'])
        .map(row => ({ 
            x: row['FECHA'], 
            y: calculateSessionVolume(row) 
        }))
        .filter(d => d.y > 0);

    drawChart(`${name}Chart2`, 'bar', [{
        label: 'Volumen Total (Kg Est.)',
        data: volumeByDate,
        backgroundColor: color + '99', 
        borderColor: color,
        borderWidth: 1
    }], {
        title: { text: 'Volumen Estimado por Sesión' },
        scales: { 
            x: { stacked: false }, 
            y: { beginAtZero: true, title: { text: 'Kg Totales (Est.)' } }
        }
    });

    // 4. Configurar Gráfico de Frecuencia Semanal (Chart 3)
    renderFrequencyChart(data, `${name}Chart3`, color, `Frecuencia Semanal ${name}`);
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

        drawChart('vsChart1', 'line', [
            { label: 'Arnau', data: pointsArnau, borderColor: '#3b82f6', backgroundColor: '#3b82f640', tension: 0.3, pointRadius: 4 },
            { label: 'Camats', data: pointsCamats, borderColor: '#10b981', backgroundColor: '#10b98140', tension: 0.3, pointRadius: 4 }
        ], {
            title: { text: `Comparativa de Progreso en ${exercise.replace(' (kg)', '')}` },
            scales: { y: { beginAtZero: true, title: { text: 'Kg Máximo' } } }
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
    
    // 4. Gráfico VS (Frecuencia Semanal)
    renderVSFrequencyChart(dataArnau, dataCamats);
}

// Calcula el volumen semanal y las etiquetas
function calculateWeeklyVolume(data) {
    let weeklyVolume = {}; // { 'YYYY-Wxx': 15000 }
    
    data.forEach(row => {
        if (row['FECHA'] && row['RUTINA']) {
            const weekKey = getWeekKey(row['FECHA']);
            if (weekKey) {
                const sessionVolume = calculateSessionVolume(row);
                if (sessionVolume > 0) {
                    if (!weeklyVolume[weekKey]) weeklyVolume[weekKey] = 0;
                    weeklyVolume[weekKey] += sessionVolume;
                }
            }
        }
    });
    
    const labels = Object.keys(weeklyVolume).sort();
    const volumes = labels.map(label => weeklyVolume[label]);
    
    return [volumes, labels];
}

function renderVSVolumeChart(dataArnau, dataCamats) {
    const [volumesArnau, labelsArnau] = calculateWeeklyVolume(dataArnau);
    const [volumesCamats, labelsCamats] = calculateWeeklyVolume(dataCamats);
    
    // Combina todas las etiquetas de semana y toma las últimas 4
    const allLabels = [...new Set([...labelsArnau, ...labelsCamats])].sort();
    const last4Labels = allLabels.slice(-4); 

    const mapVolumeToLabels = (volumeData, labels) => {
        const map = new Map();
        labels.forEach((label, index) => map.set(label, volumeData[index]));
        return last4Labels.map(label => map.get(label) || 0); // Rellenar con 0 si no hay datos en esa semana
    };

    const dataArnauMapped = mapVolumeToLabels(volumesArnau, labelsArnau);
    const dataCamatsMapped = mapVolumeToLabels(volumesCamats, labelsCamats);
    
    // Mapeamos las etiquetas de WXX a "Semana XX" para mejor visualización
    const displayLabels = last4Labels.map(label => `Semana ${label.split('-W')[1]}`);


    drawChart('vsChart2', 'bar', [
        { label: 'Arnau', data: dataArnauMapped, backgroundColor: '#3b82f699', borderColor: '#3b82f6', borderWidth: 1 },
        { label: 'Camats', data: dataCamatsMapped, backgroundColor: '#10b98199', borderColor: '#10b981', borderWidth: 1 }
    ], {
        title: { text: 'Volumen Total Semanal (Últimas 4 Semanas)' },
        scales: { 
            x: { stacked: false, type: 'category', labels: displayLabels }, 
            y: { beginAtZero: true, title: { text: 'Kg Totales (Est.)' } }
        }
    });
}

// Gráfico de Frecuencia Semanal Individual
function renderFrequencyChart(data, chartId, color, title) {
    const weeklyCounts = calculateFrequency(data);
    const labels = Object.keys(weeklyCounts).sort();
    const counts = labels.map(label => weeklyCounts[label]);
    const last4Labels = labels.slice(-4);
    const last4Counts = counts.slice(-4);
    const displayLabels = last4Labels.map(label => `Semana ${label.split('-W')[1]}`);


    drawChart(chartId, 'bar', [
        {
            label: 'Sesiones por Semana',
            data: last4Counts,
            backgroundColor: color + 'cc',
            borderColor: color,
            borderWidth: 1
        }
    ], {
        title: { text: title + ' (Últimas 4 Semanas)' },
        scales: {
            x: { type: 'category', labels: displayLabels },
            y: { beginAtZero: true, stepSize: 1, title: { text: 'Nº Sesiones' } }
        }
    });
}

// Gráfico de Frecuencia Semanal VS
function renderVSFrequencyChart(dataArnau, dataCamats) {
    const weeklyCountsArnau = calculateFrequency(dataArnau);
    const weeklyCountsCamats = calculateFrequency(dataCamats);

    const labelsArnau = Object.keys(weeklyCountsArnau);
    const labelsCamats = Object.keys(weeklyCountsCamats);

    const allLabels = [...new Set([...labelsArnau, ...labelsCamats])].sort();
    const last4Labels = allLabels.slice(-4);
    const displayLabels = last4Labels.map(label => `Semana ${label.split('-W')[1]}`);

    const mapCountsToLabels = (weeklyCounts) => {
        const map = new Map(Object.entries(weeklyCounts));
        return last4Labels.map(label => map.get(label) || 0);
    };

    const dataArnauMapped = mapCountsToLabels(weeklyCountsArnau);
    const dataCamatsMapped = mapCountsToLabels(weeklyCountsCamats);

    drawChart('vsChart3', 'bar', [
        { label: 'Arnau', data: dataArnauMapped, backgroundColor: '#3b82f699', borderColor: '#3b82f6', borderWidth: 1 },
        { label: 'Camats', data: dataCamatsMapped, backgroundColor: '#10b98199', borderColor: '#10b981', borderWidth: 1 }
    ], {
        title: { text: 'Comparativa de Frecuencia Semanal (Sesiones)' },
        scales: {
            x: { stacked: false, type: 'category', labels: displayLabels },
            y: { beginAtZero: true, stepSize: 1, title: { text: 'Nº Sesiones' } }
        }
    });
}

// ==========================================
// FUNCIÓN GENERAL DE DIBUJO DE GRÁFICOS
// ==========================================
function drawChart(chartId, type, datasets, options) {
    const ctx = document.getElementById(chartId);
    if (!ctx) return;
    
    const ctx2D = ctx.getContext('2d');
    
    if (chartInstances[chartId]) chartInstances[chartId].destroy();

    const defaultOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: '#f8fafc' } }, // Texto blanco
            tooltip: { mode: 'index', intersect: false, bodyFont: { family: 'Inter', size: 14 }, titleFont: { family: 'Inter', size: 16 } },
            title: { display: true, color: '#f8fafc', font: { size: 16 } }
        },
        scales: {
            x: { 
                type: 'category', 
                ticks: { color: '#94a3b8', maxTicksLimit: 10, maxRotation: 45, minRotation: 45 },
                grid: { color: '#1e293b50' } // Rejilla sutil
            },
            y: { 
                ticks: { color: '#94a3b8' },
                grid: { color: '#1e293b50' },
                title: { display: true, color: '#94a3b8', font: { size: 12 } }
            }
        },
        layout: {
            padding: 5
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
