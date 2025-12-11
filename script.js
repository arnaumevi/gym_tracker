// script.js
// ==========================================
// ⚠️ ATENCIÓ: ENLLAÇOS AMB GID (Identificador de Full) CORRECTES
// Si la web no carrega, assegura't que l'Excel estigui 'Publicat a la web' (CSV).
// ==========================================

// DOCUMENT ID: 1eB7Y4bntdhIl3je4x28VuHQVNraavY7hPN1qa3yQvjw
// GID Arnau: 0
// GID Camats: 1482168485

// Enllaç per la pestanya Arnau
const URL_ARNAU = "https://docs.google.com/spreadsheets/d/1eB7Y4bntdhIl3je4x28VuHQVNraavY7hPN1qa3yQvjw/export?format=csv&gid=0";

// Enllaç per la pestanya Camats
const URL_CAMATS = "https://docs.google.com/spreadsheets/d/1eB7Y4bntdhIl3je4x28VuHQVNraavY7hPN1qa3yQvjw/export?format=csv&gid=1482168485";

let chartInstance = null;

async function init() {
    try {
        // 1. Descargar y leer los CSV
        const [dataArnau, dataCamats] = await Promise.all([
            fetchData(URL_ARNAU),
            fetchData(URL_CAMATS)
        ]);

        // 2. Rellenar el desplegable con los ejercicios (leemos las columnas del CSV)
        if (dataArnau.length > 0) {
            const columns = Object.keys(dataArnau[0]);
            const exercises = columns.slice(3); // Saltamos FECHA, DÍA, RUTINA
            populateSelect(exercises);
        }

        // 3. Calcular Rachas (Streaks)
        calculateStreak(dataArnau, 'streak-arnau');
        calculateStreak(dataCamats, 'streak-camats');

        // 4. Dibujar gráfica inicial
        updateChart(dataArnau, dataCamats);

        // Escuchar cambios en el desplegable
        document.getElementById('exerciseSelect').addEventListener('change', () => {
            updateChart(dataArnau, dataCamats);
        });

    } catch (error) {
        console.error("Error cargando datos:", error);
        document.getElementById('gymChart').style.display = 'none';
        alert("No es pot carregar les dades. Revisa que l'Excel estigui publicat a la web (CSV) i que els GID siguin correctes.");
    }
}

// Función para descargar CSV y convertirlo a JSON
function fetchData(url) {
    return new Promise((resolve, reject) => {
        Papa.parse(url, {
            download: true,
            header: true, // Usa la primera fila como nombres de propiedad
            skipEmptyLines: true,
            complete: (results) => resolve(results.data),
            error: (err) => reject(err)
        });
    });
}

// Rellenar el <select>
function populateSelect(exercises) {
    const select = document.getElementById('exerciseSelect');
    exercises.forEach((ex, index) => {
        const option = document.createElement('option');
        option.value = ex;
        option.textContent = ex.replace(' (kg)', ''); // Eliminar (kg) del nombre del ejercicio
        if(index === 0) option.selected = true;
        select.appendChild(option);
    });
}

// Lógica de Gráfica
function updateChart(arnauData, camatsData) {
    const selectedExercise = document.getElementById('exerciseSelect').value;
    const ctx = document.getElementById('gymChart').getContext('2d');

    // Función auxiliar para extraer puntos (Fecha, Peso)
    const extractPoints = (data) => {
        return data.map(row => {
            // Reemplazamos coma por punto para asegurar la lectura decimal
            const peso = parseFloat(String(row[selectedExercise]).replace(',', '.')); 
            if (!peso || isNaN(peso)) return null; // Si está vacío, ignorar
            return {
                x: row['FECHA'], 
                y: peso
            };
        }).filter(p => p !== null); // Eliminar días vacíos
    };

    const pointsArnau = extractPoints(arnauData);
    const pointsCamats = extractPoints(camatsData);

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Arnau',
                    data: pointsArnau,
                    borderColor: '#a5f3fc',
                    backgroundColor: '#a5f3fc',
                    tension: 0.1,
                    pointRadius: 4
                },
                {
                    label: 'Camats',
                    data: pointsCamats,
                    borderColor: '#22c55e',
                    backgroundColor: '#22c55e',
                    tension: 0.1,
                    pointRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { 
                    type: 'category', 
                    ticks: { color: '#9ca3af', maxTicksLimit: 10 } 
                },
                y: { 
                    beginAtZero: true,
                    title: { display: true, text: 'Kg' },
                    ticks: { color: '#9ca3af' },
                    grid: { color: '#1f2937' }
                }
            },
            plugins: {
                legend: { labels: { color: '#f9fafb' } },
                title: { display: false } // El título está en el select
            }
        }
    });
}

// Lógica de Streak: Contar semanas on se ha anat 3 dies
function calculateStreak(data, elementId) {
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

    // Contar cuántas semanas completas (con 3 dies diferents)
    let perfectWeeks = 0;
    Object.values(weeklyCounts).forEach(daysSet => {
        if (daysSet.size >= 3) { // Assegurem que s'hagin registrat 3 dies DIFERENTS
            perfectWeeks++;
        }
    });

    document.getElementById(elementId).innerText = perfectWeeks;
}

// Arrancar

init();
