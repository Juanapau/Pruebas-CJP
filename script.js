// Configuración
const CONFIG = {
    // URL del Web App de Google Apps Script (reemplazar con tu URL)
    GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbw3CURWoHl3tsZd8wflU0z4C_lvU1V55RcUldl2kIzQqIc3l1JsUOlR8R8qxWvsDOtl/exec',
    NUM_ACTIVIDADES: 15,
    PORCENTAJE_APROBATORIO: 70
};

// Estado global de la aplicación
const state = {
    modulos: [],
    ras: [],
    estudiantes: [],
    calificaciones: [],
    actividades: [],
    moduloSeleccionado: null,
    raSeleccionado: null
};

// Elementos DOM
const elementos = {
    selectModulo: document.getElementById('selectModulo'),
    selectRA: document.getElementById('selectRA'),
    selectVista: document.getElementById('selectVista'),
    vistaRegistro: document.getElementById('vistaRegistro'),
    vistaActividades: document.getElementById('vistaActividades'),
    tablaRegistroHead: document.getElementById('tablaRegistroHead'),
    tablaRegistroBody: document.getElementById('tablaRegistroBody'),
    tablaActividadesHead: document.getElementById('tablaActividadesHead'),
    tablaActividadesBody: document.getElementById('tablaActividadesBody'),
    btnVolverRegistro: document.getElementById('btnVolverRegistro'),
    raDescripcion: document.getElementById('raDescripcion'),
    tituloActividades: document.getElementById('tituloActividades'),
    loading: document.getElementById('loading')
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    inicializarEventos();
    cargarDatosIniciales();
});

function inicializarEventos() {
    elementos.selectModulo.addEventListener('change', manejarCambioModulo);
    elementos.selectRA.addEventListener('change', manejarCambioRA);
    elementos.selectVista.addEventListener('change', manejarCambioVista);
    elementos.btnVolverRegistro.addEventListener('click', volverARegistro);
}

// Funciones de carga de datos
async function cargarDatosIniciales() {
    mostrarCargando(true);
    try {
        await cargarModulos();
        await cargarEstudiantes();
    } catch (error) {
        console.error('Error al cargar datos iniciales:', error);
        alert('Error al cargar los datos. Por favor, verifica la configuración.');
    } finally {
        mostrarCargando(false);
    }
}

async function cargarModulos() {
    try {
        const response = await fetch(`${CONFIG.GOOGLE_SCRIPT_URL}?action=getModulos`);
        const data = await response.json();
        state.modulos = data.modulos || [];
        poblarSelectModulos();
    } catch (error) {
        console.error('Error al cargar módulos:', error);
        // Datos de ejemplo para desarrollo
        state.modulos = [
            { id: 1, nombre: 'Análisis y diseño de reportes' },
            { id: 2, nombre: 'Desarrollo de Aplicaciones Web' },
            { id: 3, nombre: 'Base de Datos Avanzada' }
        ];
        poblarSelectModulos();
    }
}

async function cargarEstudiantes() {
    try {
        const response = await fetch(`${CONFIG.GOOGLE_SCRIPT_URL}?action=getEstudiantes`);
        const data = await response.json();
        state.estudiantes = data.estudiantes || [];
    } catch (error) {
        console.error('Error al cargar estudiantes:', error);
        // Datos de ejemplo para desarrollo
        state.estudiantes = [
            { id: 1, nombre: 'Ashly Adames Acosta', numero: 1 },
            { id: 2, nombre: 'Jeremy Almonte Rosario', numero: 2 },
            { id: 3, nombre: 'Danyeli Nicole Astacio Rodriguez', numero: 3 }
        ];
    }
}

async function cargarRAsDelModulo(moduloId) {
    mostrarCargando(true);
    try {
        const response = await fetch(`${CONFIG.GOOGLE_SCRIPT_URL}?action=getRAs&moduloId=${moduloId}`);
        const data = await response.json();
        state.ras = data.ras || [];
        poblarSelectRAs();
    } catch (error) {
        console.error('Error al cargar RAs:', error);
        // Datos de ejemplo para desarrollo
        state.ras = [
            { id: 1, codigo: 'RA01', nombre: 'Clasificar los requerimientos de información', valorTotal: 40, descripcion: 'Clasificar los requerimientos de información de los diversos usuarios para producir reportes empresariales, siguiendo parámetros establecidos.' },
            { id: 2, codigo: 'RA02', nombre: 'Analizar reportes empresariales', valorTotal: 37, descripcion: 'Analizar en grupo diferentes ejemplos de reportes empresariales y clasificarlos según su tipo (internos o externos).' },
            { id: 3, codigo: 'RA03', nombre: 'Observar reportes empresariales', valorTotal: 23, descripcion: 'Observar un reporte empresarial real y subrayar en él sus partes principales (encabezado, cuerpo, pie).' }
        ];
        poblarSelectRAs();
    } finally {
        mostrarCargando(false);
    }
}

async function cargarCalificaciones(moduloId) {
    mostrarCargando(true);
    try {
        const response = await fetch(`${CONFIG.GOOGLE_SCRIPT_URL}?action=getCalificaciones&moduloId=${moduloId}`);
        const data = await response.json();
        state.calificaciones = data.calificaciones || [];
        generarTablaRegistro();
    } catch (error) {
        console.error('Error al cargar calificaciones:', error);
        // Datos de ejemplo para desarrollo
        state.calificaciones = [];
        generarTablaRegistro();
    } finally {
        mostrarCargando(false);
    }
}

async function cargarActividadesRA(raId) {
    mostrarCargando(true);
    try {
        const response = await fetch(`${CONFIG.GOOGLE_SCRIPT_URL}?action=getActividades&raId=${raId}`);
        const data = await response.json();
        state.actividades = data.actividades || [];
        generarTablaActividades();
    } catch (error) {
        console.error('Error al cargar actividades:', error);
        // Datos de ejemplo para desarrollo
        state.actividades = generarActividadesEjemplo();
        generarTablaActividades();
    } finally {
        mostrarCargando(false);
    }
}

// Funciones para poblar selectores
function poblarSelectModulos() {
    elementos.selectModulo.innerHTML = '<option value="">Seleccione un módulo</option>';
    state.modulos.forEach(modulo => {
        const option = document.createElement('option');
        option.value = modulo.id;
        option.textContent = modulo.nombre;
        elementos.selectModulo.appendChild(option);
    });
}

function poblarSelectRAs() {
    elementos.selectRA.innerHTML = '<option value="">Seleccione un RA</option>';
    state.ras.forEach(ra => {
        const option = document.createElement('option');
        option.value = ra.id;
        option.textContent = `${ra.codigo} - ${ra.nombre}`;
        elementos.selectRA.appendChild(option);
    });
}

// Manejadores de eventos
async function manejarCambioModulo(e) {
    const moduloId = e.target.value;
    if (moduloId) {
        state.moduloSeleccionado = moduloId;
        await cargarRAsDelModulo(moduloId);
        await cargarCalificaciones(moduloId);
    } else {
        state.moduloSeleccionado = null;
        state.ras = [];
        elementos.selectRA.innerHTML = '<option value="">Seleccione un RA</option>';
        elementos.tablaRegistroHead.innerHTML = '';
        elementos.tablaRegistroBody.innerHTML = '';
    }
}

function manejarCambioRA(e) {
    const raId = e.target.value;
    state.raSeleccionado = raId;
}

function manejarCambioVista(e) {
    const vista = e.target.value;
    if (vista === 'actividades' && state.raSeleccionado) {
        mostrarVistaActividades();
    } else {
        mostrarVistaRegistro();
    }
}

function volverARegistro() {
    elementos.selectVista.value = 'general';
    mostrarVistaRegistro();
}

function mostrarVistaRegistro() {
    elementos.vistaRegistro.style.display = 'block';
    elementos.vistaActividades.style.display = 'none';
}

function mostrarVistaActividades() {
    if (!state.raSeleccionado) {
        alert('Por favor, seleccione un RA primero');
        elementos.selectVista.value = 'general';
        return;
    }
    elementos.vistaRegistro.style.display = 'none';
    elementos.vistaActividades.style.display = 'block';
    
    const raActual = state.ras.find(ra => ra.id == state.raSeleccionado);
    if (raActual) {
        elementos.tituloActividades.textContent = `Actividades del ${raActual.codigo}`;
        elementos.raDescripcion.value = raActual.descripcion || '';
    }
    
    cargarActividadesRA(state.raSeleccionado);
}

// Generación de tablas
function generarTablaRegistro() {
    if (state.ras.length === 0) {
        elementos.tablaRegistroHead.innerHTML = '';
        elementos.tablaRegistroBody.innerHTML = '';
        return;
    }

    // Generar encabezado
    let headerHTML = '<tr>';
    headerHTML += '<th class="header-valor">#</th>';
    headerHTML += '<th class="header-valor">Nombre</th>';
    
    state.ras.forEach(ra => {
        headerHTML += `<th colspan="5" class="header-ra">${ra.codigo}</th>`;
    });
    
    headerHTML += '<th class="header-total">Total</th>';
    headerHTML += '</tr>';
    
    headerHTML += '<tr>';
    headerHTML += '<th class="header-valor"></th>';
    headerHTML += '<th class="header-valor"></th>';
    
    state.ras.forEach(ra => {
        headerHTML += '<th class="header-valor">Valor</th>';
        headerHTML += '<th class="header-minimo">70%</th>';
        headerHTML += '<th class="header-oportunidad">1ra</th>';
        headerHTML += '<th class="header-oportunidad">2da</th>';
        headerHTML += '<th class="header-oportunidad">3ra</th>';
    });
    
    headerHTML += '<th class="header-total"></th>';
    headerHTML += '</tr>';
    
    elementos.tablaRegistroHead.innerHTML = headerHTML;
    
    // Generar cuerpo
    let bodyHTML = '';
    state.estudiantes.forEach(estudiante => {
        bodyHTML += '<tr>';
        bodyHTML += `<td class="numero">${estudiante.numero}</td>`;
        bodyHTML += `<td class="nombre-estudiante">${estudiante.nombre}</td>`;
        
        let totalEstudiante = 0;
        
        state.ras.forEach(ra => {
            const minimo = calcularMinimo(ra.valorTotal);
            const calificacion = obtenerCalificacion(estudiante.id, ra.id);
            
            bodyHTML += `<td><input type="number" class="input-valor-total" data-estudiante="${estudiante.id}" data-ra="${ra.id}" value="${ra.valorTotal}" min="0" max="100"></td>`;
            bodyHTML += `<td class="celda-minimo">${minimo}</td>`;
            bodyHTML += `<td><input type="number" class="input-oportunidad" data-estudiante="${estudiante.id}" data-ra="${ra.id}" data-oportunidad="1" value="${calificacion.op1 || ''}" min="0" max="${ra.valorTotal}"></td>`;
            bodyHTML += `<td><input type="number" class="input-oportunidad" data-estudiante="${estudiante.id}" data-ra="${ra.id}" data-oportunidad="2" value="${calificacion.op2 || ''}" min="0" max="${ra.valorTotal}"></td>`;
            bodyHTML += `<td><input type="number" class="input-oportunidad" data-estudiante="${estudiante.id}" data-ra="${ra.id}" data-oportunidad="3" value="${calificacion.op3 || ''}" min="0" max="${ra.valorTotal}"></td>`;
            
            const valorFinal = obtenerUltimoValor(calificacion);
            totalEstudiante += valorFinal;
        });
        
        bodyHTML += `<td class="celda-total">${totalEstudiante}</td>`;
        bodyHTML += '</tr>';
    });
    
    elementos.tablaRegistroBody.innerHTML = bodyHTML;
    
    // Agregar eventos a los inputs
    agregarEventosInputsRegistro();
}

function generarTablaActividades() {
    const raActual = state.ras.find(ra => ra.id == state.raSeleccionado);
    if (!raActual) return;
    
    // Generar encabezado
    let headerHTML = '<tr>';
    headerHTML += '<th>No.</th>';
    headerHTML += '<th>Nombres</th>';
    
    for (let i = 1; i <= CONFIG.NUM_ACTIVIDADES; i++) {
        headerHTML += `<th class="actividad-header">Ac.${i}<span class="tooltip">Actividad ${i}: ${obtenerDescripcionActividad(i)}</span></th>`;
    }
    
    headerHTML += '<th class="header-total">Total</th>';
    headerHTML += '</tr>';
    
    elementos.tablaActividadesHead.innerHTML = headerHTML;
    
    // Generar cuerpo
    let bodyHTML = '';
    state.estudiantes.forEach(estudiante => {
        bodyHTML += '<tr>';
        bodyHTML += `<td class="numero">${estudiante.numero}</td>`;
        bodyHTML += `<td class="nombre-estudiante">${estudiante.nombre}</td>`;
        
        let totalActividades = 0;
        
        for (let i = 1; i <= CONFIG.NUM_ACTIVIDADES; i++) {
            const valor = obtenerValorActividad(estudiante.id, i);
            bodyHTML += `<td><input type="number" class="input-actividad" data-estudiante="${estudiante.id}" data-actividad="${i}" value="${valor || ''}" min="0" max="10"></td>`;
            totalActividades += valor || 0;
        }
        
        bodyHTML += `<td class="celda-total">${totalActividades.toFixed(2)}</td>`;
        bodyHTML += '</tr>';
    });
    
    elementos.tablaActividadesBody.innerHTML = bodyHTML;
    
    // Agregar eventos
    agregarEventosInputsActividades();
}

// Funciones auxiliares
function calcularMinimo(valorTotal) {
    return Math.round(valorTotal * CONFIG.PORCENTAJE_APROBATORIO / 100);
}

function obtenerCalificacion(estudianteId, raId) {
    const calif = state.calificaciones.find(c => c.estudianteId == estudianteId && c.raId == raId);
    return calif || { op1: null, op2: null, op3: null };
}

function obtenerUltimoValor(calificacion) {
    if (calificacion.op3 !== null && calificacion.op3 !== '') return parseFloat(calificacion.op3);
    if (calificacion.op2 !== null && calificacion.op2 !== '') return parseFloat(calificacion.op2);
    if (calificacion.op1 !== null && calificacion.op1 !== '') return parseFloat(calificacion.op1);
    return 0;
}

function obtenerValorActividad(estudianteId, actividadNumero) {
    const actividad = state.actividades.find(a => a.estudianteId == estudianteId && a.numero == actividadNumero);
    return actividad ? actividad.valor : null;
}

function obtenerDescripcionActividad(numero) {
    const descripcion = state.actividades.find(a => a.numero == numero);
    return descripcion ? descripcion.descripcion : `Descripción de actividad ${numero}`;
}

function generarActividadesEjemplo() {
    const actividades = [];
    for (let i = 1; i <= CONFIG.NUM_ACTIVIDADES; i++) {
        actividades.push({
            numero: i,
            descripcion: `Actividad ${i} - Descripción ejemplo`
        });
    }
    return actividades;
}

// Eventos de inputs
function agregarEventosInputsRegistro() {
    // Eventos para cambio de valor total
    document.querySelectorAll('.input-valor-total').forEach(input => {
        input.addEventListener('change', function() {
            const raId = this.dataset.ra;
            const nuevoValor = parseFloat(this.value) || 0;
            
            // Actualizar el RA en el estado
            const ra = state.ras.find(r => r.id == raId);
            if (ra) {
                ra.valorTotal = nuevoValor;
            }
            
            // Recalcular tabla
            generarTablaRegistro();
        });
    });
    
    // Eventos para oportunidades
    document.querySelectorAll('.input-oportunidad').forEach(input => {
        input.addEventListener('input', function() {
            validarOportunidad(this);
        });
        
        input.addEventListener('change', function() {
            guardarCalificacion(this);
        });
    });
}

function agregarEventosInputsActividades() {
    document.querySelectorAll('.input-actividad').forEach(input => {
        input.addEventListener('change', function() {
            guardarActividad(this);
        });
    });
}

function validarOportunidad(input) {
    const estudianteId = input.dataset.estudiante;
    const raId = input.dataset.ra;
    const valor = parseFloat(input.value) || 0;
    
    const ra = state.ras.find(r => r.id == raId);
    if (!ra) return;
    
    const minimo = calcularMinimo(ra.valorTotal);
    
    if (valor < minimo && valor > 0) {
        input.classList.add('reprobado');
        input.classList.remove('aprobado');
    } else if (valor >= minimo) {
        input.classList.add('aprobado');
        input.classList.remove('reprobado');
    } else {
        input.classList.remove('reprobado', 'aprobado');
    }
}

async function guardarCalificacion(input) {
    const estudianteId = input.dataset.estudiante;
    const raId = input.dataset.ra;
    const oportunidad = input.dataset.oportunidad;
    const valor = parseFloat(input.value) || null;
    
    try {
        const response = await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'guardarCalificacion',
                estudianteId,
                raId,
                oportunidad,
                valor
            })
        });
        
        const result = await response.json();
        if (result.success) {
            // Actualizar estado local
            let calif = state.calificaciones.find(c => c.estudianteId == estudianteId && c.raId == raId);
            if (!calif) {
                calif = { estudianteId, raId, op1: null, op2: null, op3: null };
                state.calificaciones.push(calif);
            }
            calif[`op${oportunidad}`] = valor;
            
            // Recalcular totales
            generarTablaRegistro();
        }
    } catch (error) {
        console.error('Error al guardar calificación:', error);
        // En modo desarrollo, actualizar localmente
        let calif = state.calificaciones.find(c => c.estudianteId == estudianteId && c.raId == raId);
        if (!calif) {
            calif = { estudianteId, raId, op1: null, op2: null, op3: null };
            state.calificaciones.push(calif);
        }
        calif[`op${oportunidad}`] = valor;
        generarTablaRegistro();
    }
}

async function guardarActividad(input) {
    const estudianteId = input.dataset.estudiante;
    const actividadNumero = input.dataset.actividad;
    const valor = parseFloat(input.value) || null;
    
    try {
        const response = await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'guardarActividad',
                estudianteId,
                raId: state.raSeleccionado,
                actividadNumero,
                valor
            })
        });
        
        const result = await response.json();
        if (result.success) {
            // Actualizar estado local
            let act = state.actividades.find(a => a.estudianteId == estudianteId && a.numero == actividadNumero);
            if (!act) {
                act = { estudianteId, numero: actividadNumero, valor };
                state.actividades.push(act);
            } else {
                act.valor = valor;
            }
            
            // Recalcular totales
            generarTablaActividades();
        }
    } catch (error) {
        console.error('Error al guardar actividad:', error);
    }
}

function mostrarCargando(mostrar) {
    elementos.loading.style.display = mostrar ? 'block' : 'none';
}
