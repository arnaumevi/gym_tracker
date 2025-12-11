// script.js (CORREGIT - V6: Versió Catalana 100% funcional)

// ==========================================
// ⚠️ PEGA AQUÍ LA URL BASE DE PUBLICACIÓN FINAL DEL GOOGLE SHEET
// ¡¡Aquesta línia és CRÍTICA per tal que els gràfics funcionin!!
// ==========================================
const BASE_URL_PUBLISHED = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRblUmox0xuv8DtJfqboC1UXQ8tOEf4aS5PmdrHabaHgOsUdVQbUWtHjKXQF6owpG2xEOU6ekkG2idk/pub"; 
// GIDs (No canviar, són els que vas proporcionar)
const URL_ARNAU = `${BASE_URL_PUBLISHED}?gid=0&single=true&output=csv`;
const URL_CAMATS = `${BASE_URL_PUBLISHED}?gid=1482168485&single=true&output=csv`;

let chartInstances = {};
let allExercises = [];

// ==========================================
// FUNCIÓ D'INICI
// ==========================================
async function init() {
    const pageClass = document.body.className;
    
    // GUARD: Només carregar dades si estem en una pàgina d'estadístiques
    if (!pageClass.includes('stats')) {
        return; 
    }
    
    try {
        const [dataArnau, dataCamats] = await Promise.all([
            fetchData(URL_ARNAU),
            fetchData(URL_CAMATS)
        ]);
        
        // Obtenim tots els exercicis una vegada (basat en la primera fila d'Arnau)
        if (dataArnau.length > 0) {
            allExercises = Object.keys(dataArnau[0]).slice(3);
        }

        // Executar les funcions depenent de la pàgina
        if (pageClass.includes('arnau-stats')) {
            setupIndividualPage(dataArnau, 'Arnau', '#3b82f6'); // Blau
        } else if (pageClass.includes('camats-stats')) {
            setupIndividualPage(dataCamats, 'Camats', '#10b981'); // Verd
        } else if (pageClass.includes('vs-stats')) {
            setupVSPage(dataArnau, dataCamats);
        }

    } catch (error) {
        console.error("Error FATAL en carregar dades CSV:", error);
        const app = document.querySelector('.app');
        if (app) {
             app.insertAdjacentHTML('afterbegin', '<p class="error-message">❌ ERROR: No s\'han pogut carregar les dades. Revisa que la URL de publicació a "script.js" sigui correcta i que l\'Excel estigui publicat.</p>');
        }
    }
}

// ==========================================
// LÒGICA GENERAL DE DADES (Sense Canvis)
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
    
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);

    return `${d.getUTCFullYear()}-W${weekNo}`;
}

function calculateSessionVolume(row) {
    let totalVolume = 0;
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
// LÒGICA DE STREAK I FREQÜÈNCIA (Sense Canvis en la lògica)
// ==========================================
function calculateFrequency(data) {
    let weeklyCounts = {}; 

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
        if (count >= 3) { 
            perfectWeeks++;
        }
    });

    const el = document.getElementById(elementId);
    if(el) {
        el.innerText = perfectWeeks;
    }
}

// ==========================================
// LÒGICA DE PÀGINES INDIVIDUALS (Arnau/Camats)
// ==========================================

function populateSelect(selectId, exercises) {
    const select = document.getElementById(selectId);
    if (!select) return; 
    
    exercises.forEach((ex, index) => {
        const option = document.createElement('option');
        option.value = ex;
        // Netejar el text del selector per a la visualització
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
    calculateStreak(data, `streak-${name.toLowerCase()}`);

    // 2. Configurar Gràfic de Progressió (Chart 1)
    const selectId = `exerciseSelect${name}`;
    
    populateSelect(selectId, allExercises);

    const renderProgressionChart = (exercise) => {
        const points = getProgressionPoints(data, exercise);
        drawChart(`${name.toLowerCase()}Chart1`, 'line', [{
            label: `Progrés ${name}`,
            data: points,
            borderColor: color,
            backgroundColor: `${color}40`, 
            tension: 0.3,
            pointRadius: 4
        }], {
            title: { text: `Progressió de Pes a ${exercise.replace(' (kg)', '')}` },
            scales: { y: { beginAtZero: true, title: { text: 'Kg Màxim' } } }
        });
    };

    const selectElement = document.getElementById(selectId);
    if (selectElement) {
        if (selectElement.value) {
            renderProgressionChart(selectElement.value);
        }
        selectElement.addEventListener('change', (e) => renderProgressionChart(e.target.value));
    }
    
    // 3. Configurar Gràfic de Volum Diari (Chart 2)
    const volumeByDate = data
        .filter(row => row['FECHA'] && row['RUTINA'])
        .map(row => ({ 
            x: row['FECHA'], 
            y: calculateSessionVolume(row) 
        }))
        .filter(d => d.y > 0);

    drawChart(`${name.toLowerCase()}Chart2`, 'bar', [{
        label: 'Volum Total (Kg Est.)',
        data: volumeByDate,
        backgroundColor: color + '99', 
        borderColor: color,
        borderWidth: 1
    }], {
        title: { text: 'Volum Estimat per Sessió' },
        scales: { 
            x: { stacked: false }, 
            y: { beginAtZero: true, title: { text: 'Kg Totals (Est.)' } }
        }
    });

    // 4. Configurar Gràfic de Freqüència Setmanal (Chart 3)
    renderFrequencyChart(data, `${name.toLowerCase()}Chart3`, color, `Freqüència Setmanal ${name}`);
}

// ==========================================
// LÒGICA DE PÀGINA VS (Textos en Català)
// ==========================================
function setupVSPage(dataArnau, dataCamats) {
    // 1. Streaks
    calculateStreak(dataArnau, 'streak-arnau-vs');
    calculateStreak(dataCamats, 'streak-camats-vs');

    // 2. Gràfic VS (Força Màxima)
    populateSelect('exerciseSelectVS', allExercises);

    const renderVSChart = (exercise) => {
        const pointsArnau = getProgressionPoints(dataArnau, exercise);
        const pointsCamats = getProgressionPoints(dataCamats, exercise);

        drawChart('vsChart1', 'line', [
            { label: 'Arnau', data: pointsArnau, borderColor: '#3b82f6', backgroundColor: '#3b82f640', tension: 0.3, pointRadius: 4 },
            { label: 'Camats', data: pointsCamats, borderColor: '#10b981', backgroundColor: '#10b98140', tension: 0.3, pointRadius: 4 }
        ], {
            title: { text: `Comparativa de Progrés a ${exercise.replace(' (kg)', '')}` },
            scales: { y: { beginAtZero: true, title: { text: 'Kg Màxim' } } }
        });
    };

    const selectElement = document.getElementById('exerciseSelectVS');
    if (selectElement) {
        if (selectElement.value) {
            renderVSChart(selectElement.value);
        }
        selectElement.addEventListener('change', (e) => renderVSChart(e.target.value));
    }
    
    // 3. Gràfic VS (Volum Setmanal)
    renderVSVolumeChart(dataArnau, dataCamats);
    
    // 4. Gràfic VS (Freqüència Setmanal)
    renderVSFrequencyChart(dataArnau, dataCamats);
}

// Calcula el volum setmanal i les etiquetes
function calculateWeeklyVolume(data) {
    let weeklyVolume = {}; 
    
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
    
    const allLabels = [...new Set([...labelsArnau, ...labelsCamats])].sort();
    const last4Labels = allLabels.slice(-4); 

    const mapVolumeToLabels = (volumeData, labels) => {
        const map = new Map();
        labels.forEach((label, index) => map.set(label, volumeData[index]));
        return last4Labels.map(label => map.get(label) || 0); 
    };

    const dataArnauMapped = mapVolumeToLabels(volumesArnau, labelsArnau);
    const dataCamatsMapped = mapVolumeToLabels(volumesCamats, labelsCamats);
    
    const displayLabels = last4Labels.map(label => `Setmana ${label.split('-W')[1]}`);


    drawChart('vsChart2', 'bar', [
        { label: 'Arnau', data: dataArnauMapped, backgroundColor: '#3b82f699', borderColor: '#3b82f6', borderWidth: 1 },
        { label: 'Camats', data: dataCamatsMapped, backgroundColor: '#10b98199', borderColor: '#10b981', borderWidth: 1 }
    ], {
        title: { text: 'Volum Total Setmanal (Últimes 4 Setmanes)' },
        scales: { 
            x: { stacked: false, type: 'category', labels: displayLabels }, 
            y: { beginAtZero: true, title: { text: 'Kg Totals (Est.)' } }
        }
    });
}

// Gràfic de Freqüència Setmanal Individual
function renderFrequencyChart(data, chartId, color, title) {
    const weeklyCounts = calculateFrequency(data);
    const labels = Object.keys(weeklyCounts).sort();
    const counts = labels.map(label => weeklyCounts[label]);
    const last4Labels = labels.slice(-4);
    const last4Counts = counts.slice(-4);
    const displayLabels = last4Labels.map(label => `Setmana ${label.split('-W')[1]}`);


    drawChart(chartId, 'bar', [
        {
            label: 'Sessions per Setmana',
            data: last4Counts,
            backgroundColor: color + 'cc',
            borderColor: color,
            borderWidth: 1
        }
    ], {
        title: { text: title + ' (Últimes 4 Setmanes)' },
        scales: {
            x: { type: 'category', labels: displayLabels },
            y: { beginAtZero: true, stepSize: 1, title: { text: 'Núm. Sessions' } }
        }
    });
}

// Gràfic de Freqüència Setmanal VS
function renderVSFrequencyChart(dataArnau, dataCamats) {
    const weeklyCountsArnau = calculateFrequency(dataArnau);
    const weeklyCountsCamats = calculateFrequency(dataCamats);

    const labelsArnau = Object.keys(weeklyCountsArnau);
    const labelsCamats = Object.keys(weeklyCountsCamats);

    const allLabels = [...new Set([...labelsArnau, ...labelsCamats])].sort();
    const last4Labels = allLabels.slice(-4);
    const displayLabels = last4Labels.map(label => `Setmana ${label.split('-W')[1]}`);

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
        title: { text: 'Comparativa de Freqüència Setmanal (Sessions)' },
        scales: {
            x: { stacked: false, type: 'category', labels: displayLabels },
            y: { beginAtZero: true, stepSize: 1, title: { text: 'Núm. Sessions' } }
        }
    });
}

// Funció general de dibuix de gràfics (sense canvis)
function drawChart(chartId, type, datasets, options) {
    const ctx = document.getElementById(chartId);
    if (!ctx) return;
    
    const ctx2D = ctx.getContext('2d');
    
    if (chartInstances[chartId]) chartInstances[chartId].destroy();

    const defaultOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: '#f8fafc' } }, 
            tooltip: { mode: 'index', intersect: false, bodyFont: { family: 'Inter', size: 14 }, titleFont: { family: 'Inter', size: 16 } },
            title: { display: true, color: '#f8fafc', font: { size: 16 } }
        },
        scales: {
            x: { 
                type: 'category', 
                ticks: { color: '#94a3b8', maxTicksLimit: 10, maxRotation: 45, minRotation: 45 },
                grid: { color: '#1e293b50' } 
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
