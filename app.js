const url = "https://docs.google.com/spreadsheets/d/1J9Z6a5DbzElWSh1wNIQN0H7I_9bHpCA7RoMtT-8Y-v0/gviz/tq?tqx=out:json";

let chartDias = null;
let chartHoras = null;

const diasSemana = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

function obtenerFecha(celda) {
  if (!celda) return null;

  if (celda.v instanceof Date) return celda.v;

  if (typeof celda.v === "string" && celda.v.includes("Date")) {
    const valores = celda.v.match(/\d+/g).map(Number);
    return new Date(valores[0], valores[1], valores[2], valores[3] || 0, valores[4] || 0, valores[5] || 0);
  }

  if (celda.f) {
    const fecha = new Date(celda.f);
    if (!isNaN(fecha)) return fecha;
  }

  return null;
}

function nombreDia(fecha) {
  const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  return dias[fecha.getDay()];
}

function formatoHora(fecha) {
  return fecha.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

async function cargarDatos() {
  try {
    const respuesta = await fetch(url);
    const texto = await respuesta.text();
    const json = JSON.parse(texto.substring(47).slice(0, -2));

    const datos = json.table.rows
      .filter(row => row.c && row.c[2])
      .map(row => {
        const fecha = obtenerFecha(row.c[2]);

        return {
          fecha,
          dia: fecha ? nombreDia(fecha) : "",
          hora: fecha ? formatoHora(fecha) : "--",
          horaEntera: fecha ? fecha.getHours() : 0,
          subieron: row.c[3]?.v || 0,
          bajaron: row.c[4]?.v || 0,
          abordo: row.c[5]?.v || 0
        };
      })
      .filter(d => d.fecha && diasSemana.includes(d.dia));

    const resumenDias = {};
    const resumenHoras = {};

    diasSemana.forEach(dia => {
      resumenDias[dia] = {
        subieron: 0,
        bajaron: 0,
        maxOcupacion: 0,
        horaPico: "--"
      };
    });

    let totalSemana = 0;
    let sumaOcupacion = 0;
    let maxOcupacion = 0;
    let horaPicoSemana = "--";

    datos.forEach(d => {
      totalSemana += d.subieron;
      sumaOcupacion += d.abordo;

      resumenDias[d.dia].subieron += d.subieron;
      resumenDias[d.dia].bajaron += d.bajaron;

      if (d.abordo > resumenDias[d.dia].maxOcupacion) {
        resumenDias[d.dia].maxOcupacion = d.abordo;
        resumenDias[d.dia].horaPico = d.hora;
      }

      if (d.abordo > maxOcupacion) {
        maxOcupacion = d.abordo;
        horaPicoSemana = d.hora;
      }

      const horaTexto = `${String(d.horaEntera).padStart(2, "0")}:00`;

      if (!resumenHoras[horaTexto]) {
        resumenHoras[horaTexto] = {
          suma: 0,
          cantidad: 0
        };
      }

      resumenHoras[horaTexto].suma += d.abordo;
      resumenHoras[horaTexto].cantidad++;
    });

    let diaMayor = "--";
    let valorDiaMayor = 0;

    diasSemana.forEach(dia => {
      if (resumenDias[dia].subieron > valorDiaMayor) {
        valorDiaMayor = resumenDias[dia].subieron;
        diaMayor = dia;
      }
    });

    const promedioOcupacion = datos.length > 0 ? sumaOcupacion / datos.length : 0;

    document.getElementById("totalSemana").innerText = totalSemana;
    document.getElementById("diaMayor").innerText = diaMayor;
    document.getElementById("pasajerosDiaMayor").innerText = `${valorDiaMayor} pasajeros`;
    document.getElementById("horaPico").innerText = horaPicoSemana;
    document.getElementById("maxOcupacion").innerText = maxOcupacion;
    document.getElementById("promedioOcupacion").innerText = promedioOcupacion.toFixed(1);
    document.getElementById("fechaSistema").innerText = new Date().toLocaleString("es-CO");

    crearGraficaDias(resumenDias);
    crearGraficaHoras(resumenHoras);
    crearTabla(resumenDias, totalSemana);
    crearConclusiones(diaMayor, valorDiaMayor, horaPicoSemana, maxOcupacion, promedioOcupacion);

  } catch (error) {
    console.error("Error al cargar los datos:", error);
    document.getElementById("fechaSistema").innerText = "Error al cargar datos";
  }
}

function crearGraficaDias(resumenDias) {
  const ctx = document.getElementById("chartDias");

  const valores = diasSemana.map(dia => resumenDias[dia].subieron);

  if (chartDias) chartDias.destroy();

  chartDias = new Chart(ctx, {
    type: "bar",
    data: {
      labels: diasSemana,
      datasets: [{
        label: "Pasajeros que subieron",
        data: valores,
        backgroundColor: "#007a3d",
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Pasajeros"
          }
        }
      }
    }
  });
}

function crearGraficaHoras(resumenHoras) {
  const ctx = document.getElementById("chartHoras");

  const horas = Object.keys(resumenHoras).sort();

  const valores = horas.map(hora => {
    const dato = resumenHoras[hora];
    return (dato.suma / dato.cantidad).toFixed(1);
  });

  if (chartHoras) chartHoras.destroy();

  chartHoras = new Chart(ctx, {
    type: "line",
    data: {
      labels: horas,
      datasets: [{
        label: "Promedio de pasajeros a bordo",
        data: valores,
        borderColor: "#007a3d",
        backgroundColor: "#007a3d",
        borderWidth: 3,
        tension: 0.35,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Pasajeros a bordo"
          }
        },
        x: {
          title: {
            display: true,
            text: "Hora del día"
          }
        }
      }
    }
  });
}

function crearTabla(resumenDias, totalSemana) {
  let html = "";
  let totalBajaron = 0;
  let maxTotal = 0;
  let horaPicoTotal = "--";

  diasSemana.forEach(dia => {
    const d = resumenDias[dia];

    totalBajaron += d.bajaron;

    if (d.maxOcupacion > maxTotal) {
      maxTotal = d.maxOcupacion;
      horaPicoTotal = d.horaPico;
    }

    html += `
      <tr>
        <td>${dia}</td>
        <td>${d.subieron}</td>
        <td>${d.bajaron}</td>
        <td>${d.maxOcupacion}</td>
        <td>${d.horaPico}</td>
      </tr>
    `;
  });

  html += `
    <tr class="total">
      <td>Total semana</td>
      <td>${totalSemana}</td>
      <td>${totalBajaron}</td>
      <td>${maxTotal}</td>
      <td>${horaPicoTotal}</td>
    </tr>
  `;

  document.getElementById("tablaSemanal").innerHTML = html;
}

function crearConclusiones(diaMayor, valorDiaMayor, horaPicoSemana, maxOcupacion, promedioOcupacion) {
  const conclusiones = [
    `🚌 El día de mayor demanda fue ${diaMayor}, con ${valorDiaMayor} pasajeros registrados.`,
    `🚌 La hora pico de la semana se presentó alrededor de las ${horaPicoSemana}.`,
    `🚌 La máxima ocupación registrada fue de ${maxOcupacion} pasajeros a bordo.`,
    `🚌 El promedio de ocupación durante la semana fue de ${promedioOcupacion.toFixed(1)} pasajeros a bordo.`,
    `🚌 La información recolectada permite identificar patrones iniciales de uso del transporte interno.`
  ];

  document.getElementById("listaConclusiones").innerHTML = conclusiones
    .map(c => `<li>${c}</li>`)
    .join("");
}

cargarDatos();
setInterval(cargarDatos, 30000);