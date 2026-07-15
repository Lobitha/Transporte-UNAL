const url = "https://docs.google.com/spreadsheets/d/1J9Z6a5DbzElWSh1wNIQN0H7I_9bHpCA7RoMtT-8Y-v0/gviz/tq?tqx=out:json";

let chartDias = null;
let chartHoras = null;

const diasSemana = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const diasMedidos = ["Lunes", "Martes", "Miércoles", "Jueves"];

function obtenerFecha(celda) {
  if (!celda) return null;

  if (celda.v instanceof Date) return celda.v;

  if (typeof celda.v === "string" && celda.v.includes("Date")) {
    const valores = celda.v.match(/\d+/g).map(Number);

    return new Date(
      valores[0],
      valores[1],
      valores[2],
      valores[3] || 0,
      valores[4] || 0,
      valores[5] || 0
    );
  }

  if (celda.f) {
    const fecha = new Date(celda.f);

    if (!isNaN(fecha)) {
      return fecha;
    }
  }

  return null;
}

function nombreDia(fecha) {
  const dias = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado"
  ];

  return dias[fecha.getDay()];
}

function formatoHora(fecha) {
  return fecha.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function convertirHoraAMinutos(hora) {
  if (!hora || hora === "--") return null;

  const partes = hora.split(":").map(Number);

  if (partes.length < 2) return null;

  return partes[0] * 60 + partes[1];
}

function convertirMinutosAHora(minutosTotales) {
  const minutosDia = 24 * 60;
  const minutosAjustados =
    ((minutosTotales % minutosDia) + minutosDia) % minutosDia;

  const hora = Math.floor(minutosAjustados / 60);
  const minutos = minutosAjustados % 60;

  return `${String(hora).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
}

function calcularViernesEstimado(resumenDias) {
  const promedioSubieron = Math.round(
    diasMedidos.reduce(
      (suma, dia) => suma + resumenDias[dia].subieron,
      0
    ) / diasMedidos.length
  );

  const promedioMaxOcupacion = Math.round(
    diasMedidos.reduce(
      (suma, dia) => suma + resumenDias[dia].maxOcupacion,
      0
    ) / diasMedidos.length
  );

  const horasPicoValidas = diasMedidos
    .map(dia => convertirHoraAMinutos(resumenDias[dia].horaPico))
    .filter(minutos => minutos !== null);

  let horaPicoPromedio = "--";

  if (horasPicoValidas.length > 0) {
    const minutosPromedio = Math.round(
      horasPicoValidas.reduce((suma, minutos) => suma + minutos, 0) /
      horasPicoValidas.length
    );

    horaPicoPromedio = convertirMinutosAHora(minutosPromedio);
  }

  resumenDias.Viernes = {
    subieron: promedioSubieron,
    maxOcupacion: promedioMaxOcupacion,
    horaPico: horaPicoPromedio,
    estimado: true
  };
}

async function cargarDatos() {
  try {
    const respuesta = await fetch(url);

    if (!respuesta.ok) {
      throw new Error(`Error HTTP: ${respuesta.status}`);
    }

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
          subieron: Number(row.c[3]?.v) || 0,
          abordo: Number(row.c[5]?.v) || 0
        };
      })
      .filter(dato => dato.fecha && diasSemana.includes(dato.dia));

    const resumenDias = {};
    const resumenHoras = {};

    diasSemana.forEach(dia => {
      resumenDias[dia] = {
        subieron: 0,
        maxOcupacion: 0,
        horaPico: "--",
        estimado: false
      };
    });

    let totalMedido = 0;
    let sumaOcupacion = 0;
    let cantidadOcupaciones = 0;
    let maxOcupacionReal = 0;
    let horaPicoSemana = "--";

    datos.forEach(dato => {
      totalMedido += dato.subieron;
      sumaOcupacion += dato.abordo;
      cantidadOcupaciones++;

      resumenDias[dato.dia].subieron += dato.subieron;

      if (dato.abordo > resumenDias[dato.dia].maxOcupacion) {
        resumenDias[dato.dia].maxOcupacion = dato.abordo;
        resumenDias[dato.dia].horaPico = dato.hora;
      }

      if (dato.abordo > maxOcupacionReal) {
        maxOcupacionReal = dato.abordo;
        horaPicoSemana = dato.hora;
      }

      const horaTexto =
        `${String(dato.horaEntera).padStart(2, "0")}:00`;

      if (!resumenHoras[horaTexto]) {
        resumenHoras[horaTexto] = {
          suma: 0,
          cantidad: 0
        };
      }

      resumenHoras[horaTexto].suma += dato.abordo;
      resumenHoras[horaTexto].cantidad++;
    });

    calcularViernesEstimado(resumenDias);

    const totalSemana =
      totalMedido + resumenDias.Viernes.subieron;

    let diaMayor = "--";
    let valorDiaMayor = 0;

    diasSemana.forEach(dia => {
      if (resumenDias[dia].subieron > valorDiaMayor) {
        valorDiaMayor = resumenDias[dia].subieron;
        diaMayor = dia;
      }
    });

    const promedioOcupacionMedido =
      cantidadOcupaciones > 0
        ? sumaOcupacion / cantidadOcupaciones
        : 0;

    const promedioOcupacionSemanal =
      (
        promedioOcupacionMedido * 4 +
        resumenDias.Viernes.maxOcupacion
      ) / 5;

    document.getElementById("totalSemana").innerText = totalSemana;
    document.getElementById("diaMayor").innerText = diaMayor;
    document.getElementById("pasajerosDiaMayor").innerText =
      `${valorDiaMayor} pasajeros`;
    document.getElementById("horaPico").innerText = horaPicoSemana;
    document.getElementById("maxOcupacion").innerText = maxOcupacionReal;
    document.getElementById("promedioOcupacion").innerText =
      promedioOcupacionSemanal.toFixed(1);
    document.getElementById("fechaSistema").innerText =
      new Date().toLocaleString("es-CO");

    crearGraficaDias(resumenDias);
    crearGraficaHoras(resumenHoras);
    crearTabla(resumenDias, totalSemana);
    crearConclusiones(
      diaMayor,
      valorDiaMayor,
      horaPicoSemana,
      maxOcupacionReal,
      promedioOcupacionSemanal
    );

  } catch (error) {
    console.error("Error al cargar los datos:", error);

    document.getElementById("fechaSistema").innerText =
      "Error al cargar datos";
  }
}

function crearGraficaDias(resumenDias) {
  const ctx = document.getElementById("chartDias");

  const valores = diasSemana.map(
    dia => resumenDias[dia].subieron
  );

  if (chartDias) {
    chartDias.destroy();
  }

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
        },
        tooltip: {
          callbacks: {
            afterLabel(contexto) {
              return contexto.dataIndex === 4
                ? "Valor estimado"
                : "";
            }
          }
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

    return Number(
      (dato.suma / dato.cantidad).toFixed(1)
    );
  });

  if (chartHoras) {
    chartHoras.destroy();
  }

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
  let maxTotal = 0;
  let horaPicoTotal = "--";

  diasSemana.forEach(dia => {
    const dato = resumenDias[dia];

    if (dato.maxOcupacion > maxTotal) {
      maxTotal = dato.maxOcupacion;
      horaPicoTotal = dato.horaPico;
    }

    const nombreMostrado =
      dato.estimado ? `${dia}*` : dia;

    html += `
      <tr>
        <td>${nombreMostrado}</td>
        <td>${dato.subieron}</td>
        <td>${dato.maxOcupacion}</td>
        <td>${dato.horaPico}</td>
      </tr>
    `;
  });

  html += `
    <tr class="total">
      <td>Total semana</td>
      <td>${totalSemana}</td>
      <td>${maxTotal}</td>
      <td>${horaPicoTotal}</td>
    </tr>
  `;

  document.getElementById("tablaSemanal").innerHTML = html;
}

function crearConclusiones(
  diaMayor,
  valorDiaMayor,
  horaPicoSemana,
  maxOcupacion,
  promedioOcupacion
) {
  const conclusiones = [
    `🚌 El día de mayor demanda fue ${diaMayor}, con ${valorDiaMayor} pasajeros registrados.`,
    `🚌 La hora pico de la semana se presentó alrededor de las ${horaPicoSemana}.`,
    `🚌 La máxima ocupación registrada fue de ${maxOcupacion} pasajeros a bordo.`,
    `🚌 El promedio de ocupación semanal fue de ${promedioOcupacion.toFixed(1)} pasajeros a bordo.`,
    `🚌 Los valores del viernes corresponden al promedio estimado de lunes a jueves.`
  ];

  document.getElementById("listaConclusiones").innerHTML =
    conclusiones
      .map(conclusion => `<li>${conclusion}</li>`)
      .join("");
}

cargarDatos();
setInterval(cargarDatos, 30000);
