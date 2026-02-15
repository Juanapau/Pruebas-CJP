// Configuración
const CONFIG = {
    // URL del Web App de Google Apps Script (reemplazar con tu URL)
    GOOGLE_SCRIPT_URL: 'TU_URL_DE_GOOGLE_APPS_SCRIPT_AQUI',
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
    raSeleccionado: null,
    cursoSeleccionado: null
};

// Elementos DOM
const elementos = {
    selectCurso: document.getElementById('selectCurso'),
    selectModulo: document.getElementById('selectModulo'),
    selectRA: document.getElementById('selectRA'),
    vistaRegistro: document.getElementById('vistaRegistro'),
    vistaActividades: document.getElementById('vistaActividades'),
    tablaRegistroHead: document.getElementById('tablaRegistroHead'),
    tablaRegistroBody: document.getElementById('tablaRegistroBody'),
    tablaActividadesHead: document.getElementById('tablaActividadesHead'),
    tablaActividadesBody: document.getElementById('tablaActividadesBody'),
    btnVolverRegistro: document.getElementById('btnVolverRegistro'),
    btnGuardarRegistro: document.getElementById('btnGuardarRegistro'),
    btnGuardarActividades: document.getElementById('btnGuardarActividades'),
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
    elementos.selectCurso.addEventListener('change', manejarCambioCurso);
    elementos.selectModulo.addEventListener('change', manejarCambioModulo);
    elementos.selectRA.addEventListener('change', manejarCambioRA);
    elementos.btnVolverRegistro.addEventListener('click', volverARegistro);
    elementos.btnGuardarRegistro.addEventListener('click', guardarTodoElRegistro);
    elementos.btnGuardarActividades.addEventListener('click', guardarTodasLasActividades);
}

// Funciones de carga de datos
async function cargarDatosIniciales() {
    mostrarCargando(true);
    try {
        await cargarModulos();
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
        console.log('Módulos cargados desde servidor:', state.modulos);
        poblarSelectModulos();
    } catch (error) {
        console.error('Error al cargar módulos:', error);
        // Datos de ejemplo para desarrollo
        state.modulos = [
            { id: 1, nombre: 'Análisis y Diseño de Reportes', codigo: 'ADR', curso: '5toB' },
            { id: 2, nombre: 'Desarrollo de Portales Web y Recursos Multimedia', codigo: 'DPWRM', curso: '4toB' }
        ];
        console.log('Módulos cargados (modo desarrollo):', state.modulos);
        poblarSelectModulos();
    }
}

async function cargarEstudiantes(curso) {
    try {
        const response = await fetch(`${CONFIG.GOOGLE_SCRIPT_URL}?action=getEstudiantes&curso=${curso}`);
        const data = await response.json();
        state.estudiantes = data.estudiantes || [];
    } catch (error) {
        console.error('Error al cargar estudiantes:', error);
        // Datos de ejemplo para desarrollo
        state.estudiantes = [
            { id: 1, nombre: 'Ashly Adames Acosta', numero: 1, curso: curso },
            { id: 2, nombre: 'Jeremy Almonte Rosario', numero: 2, curso: curso },
            { id: 3, nombre: 'Astacio Rodriguez Danyeli Nicole', numero: 3, curso: curso },
            { id: 4, nombre: 'Aybar Alberth', numero: 4, curso: curso },
            { id: 5, nombre: 'Batista Castillo Albani Joel', numero: 5, curso: curso },
            { id: 6, nombre: 'Bonifacio Espino Johanlly', numero: 6, curso: curso },
            { id: 7, nombre: 'Candelario De León Nashla', numero: 7, curso: curso },
            { id: 8, nombre: 'Del Rosario R. María Esterlin', numero: 8, curso: curso }
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
        if (moduloId == 1) {
            // Análisis y Diseño de Reportes - 3 RAs
            state.ras = [
                { id: 1, moduloId: 1, codigo: 'RA01', nombre: 'RA1', valorTotal: 40, descripcion: 'Clasificar los requerimientos de información de los diversos usuarios para producir reportes empresariales, siguiendo parámetros establecidos.' },
                { id: 2, moduloId: 1, codigo: 'RA02', nombre: 'RA2', valorTotal: 37, descripcion: 'Analizar en grupo diferentes ejemplos de reportes empresariales y clasificarlos según su tipo (internos o externos).' },
                { id: 3, moduloId: 1, codigo: 'RA03', nombre: 'RA3', valorTotal: 23, descripcion: 'Observar un reporte empresarial real y subrayar en él sus partes principales (encabezado, cuerpo, pie).' }
            ];
        } else if (moduloId == 2) {
            // Desarrollo de Portales Web y Recursos Multimedia - 4 RAs
            state.ras = [
                { id: 4, moduloId: 2, codigo: 'RA01', nombre: 'RA1', valorTotal: 25, descripcion: 'Desarrollar portales web aplicando tecnologías actuales.' },
                { id: 5, moduloId: 2, codigo: 'RA02', nombre: 'RA2', valorTotal: 25, descripcion: 'Integrar recursos multimedia en portales web.' },
                { id: 6, moduloId: 2, codigo: 'RA03', nombre: 'RA3', valorTotal: 25, descripcion: 'Implementar diseño responsive en portales web.' },
                { id: 7, moduloId: 2, codigo: 'RA04', nombre: 'RA4', valorTotal: 25, descripcion: 'Optimizar portales web para rendimiento y accesibilidad.' }
            ];
        }
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
    
    console.log('Estado actual - cursoSeleccionado:', state.cursoSeleccionado);
    console.log('Módulos disponibles:', state.modulos);
    
    // Filtrar módulos según el curso seleccionado
    const modulosFiltrados = state.cursoSeleccionado 
        ? state.modulos.filter(m => m.curso === state.cursoSeleccionado)
        : state.modulos;
    
    console.log('Módulos filtrados:', modulosFiltrados);
    
    modulosFiltrados.forEach(modulo => {
        const option = document.createElement('option');
        option.value = modulo.id;
        option.textContent = modulo.nombre;
        elementos.selectModulo.appendChild(option);
    });
    
    console.log('Opciones agregadas al select:', elementos.selectModulo.children.length - 1); // -1 por la opción "Seleccione"
}

function poblarSelectRAs() {
    elementos.selectRA.innerHTML = '<option value="">Seleccione un RA</option>';
    state.ras.forEach(ra => {
        const option = document.createElement('option');
        option.value = ra.id;
        option.textContent = `Actividades ${ra.nombre}`;
        elementos.selectRA.appendChild(option);
    });
}

// Manejadores de eventos
async function manejarCambioCurso(e) {
    const curso = e.target.value;
    if (curso) {
        state.cursoSeleccionado = curso;
        await cargarEstudiantes(curso);
        poblarSelectModulos(); // Filtrar módulos según el curso seleccionado
        // Si ya hay un módulo seleccionado, recargar la tabla
        if (state.moduloSeleccionado) {
            await cargarCalificaciones(state.moduloSeleccionado);
        }
    } else {
        state.cursoSeleccionado = null;
        state.estudiantes = [];
        poblarSelectModulos(); // Mostrar todos los módulos
        elementos.tablaRegistroHead.innerHTML = '';
        elementos.tablaRegistroBody.innerHTML = '';
    }
}

async function manejarCambioModulo(e) {
    const moduloId = e.target.value;
    if (moduloId) {
        if (!state.cursoSeleccionado) {
            alert('Por favor, seleccione primero un curso');
            e.target.value = '';
            return;
        }
        state.moduloSeleccionado = moduloId;
        await cargarRAsDelModulo(moduloId);
        await cargarCalificaciones(moduloId);
        // Mostrar botón guardar
        elementos.btnGuardarRegistro.style.display = 'flex';
    } else {
        state.moduloSeleccionado = null;
        state.ras = [];
        elementos.selectRA.innerHTML = '<option value="">Seleccione un RA</option>';
        elementos.tablaRegistroHead.innerHTML = '';
        elementos.tablaRegistroBody.innerHTML = '';
        // Ocultar botón guardar
        elementos.btnGuardarRegistro.style.display = 'none';
    }
}

function manejarCambioRA(e) {
    const raId = e.target.value;
    if (raId) {
        state.raSeleccionado = raId;
        mostrarVistaActividades();
    } else {
        state.raSeleccionado = null;
    }
}

function volverARegistro() {
    elementos.selectRA.value = '';
    state.raSeleccionado = null;
    mostrarVistaRegistro();
    // Regenerar la tabla para mostrar los valores actualizados
    generarTablaRegistro();
}

function mostrarVistaRegistro() {
    elementos.vistaRegistro.style.display = 'block';
    elementos.vistaActividades.style.display = 'none';
}

function mostrarVistaActividades() {
    if (!state.raSeleccionado) {
        alert('Por favor, seleccione un RA primero');
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
    if (state.ras.length === 0 || state.estudiantes.length === 0) {
        elementos.tablaRegistroHead.innerHTML = '';
        elementos.tablaRegistroBody.innerHTML = '';
        return;
    }

    // Generar encabezado - Primera fila con los códigos de RA
    let headerHTML = '<tr>';
    headerHTML += '<th rowspan="3" class="header-numero">#</th>';
    headerHTML += '<th rowspan="3" class="header-nombre">Nombre</th>';
    
    state.ras.forEach(ra => {
        // Cada RA ocupa SOLO 3 columnas (las 3 oportunidades)
        headerHTML += `<th colspan="3" class="header-ra">%${ra.codigo}</th>`;
    });
    
    headerHTML += '<th rowspan="3" class="header-total">Total</th>';
    headerHTML += '</tr>';
    
    // Segunda fila: 40 (colspan 2) y 28 (colspan 1) sobre las 3 columnas
    headerHTML += '<tr>';
    
    state.ras.forEach(ra => {
        const minimo = calcularMinimo(ra.valorTotal || 0);
        // 40 ocupa 2 columnas, 28 ocupa 1 columna (total 3)
        headerHTML += `<th colspan="2" class="header-valor-num"><input type="number" class="input-valor-ra" data-ra="${ra.id}" value="${ra.valorTotal || 0}" min="0" max="100"></th>`;
        headerHTML += `<th class="header-minimo-num">${minimo}</th>`;
    });
    
    headerHTML += '</tr>';
    
    // Tercera fila: "Valor" (colspan 2) y "70%" (colspan 1)
    headerHTML += '<tr>';
    
    state.ras.forEach(ra => {
        headerHTML += `<th colspan="2" class="header-label-valor">Valor</th>`;
        headerHTML += `<th class="header-label-70">70%</th>`;
    });
    
    headerHTML += '</tr>';
    
    elementos.tablaRegistroHead.innerHTML = headerHTML;
    
    // Generar cuerpo - SOLO 3 celdas por RA (las 3 oportunidades)
    let bodyHTML = '';
    state.estudiantes.forEach(estudiante => {
        bodyHTML += '<tr>';
        bodyHTML += `<td class="numero">${estudiante.numero}</td>`;
        bodyHTML += `<td class="nombre-estudiante">${estudiante.nombre}</td>`;
        
        let totalEstudiante = 0;
        
        state.ras.forEach(ra => {
            const calificacion = obtenerCalificacion(estudiante.id, ra.id);
            const valorFinal = obtenerUltimoValor(calificacion);
            totalEstudiante += valorFinal;
            
            // SOLO 3 celdas: las 3 oportunidades
            bodyHTML += `<td class="celda-oportunidad"><input type="number" class="input-oportunidad-simple" data-estudiante="${estudiante.id}" data-ra="${ra.id}" data-oportunidad="1" value="${calificacion.op1 || ''}" min="0" max="${ra.valorTotal}"></td>`;
            bodyHTML += `<td class="celda-oportunidad"><input type="number" class="input-oportunidad-simple" data-estudiante="${estudiante.id}" data-ra="${ra.id}" data-oportunidad="2" value="${calificacion.op2 || ''}" min="0" max="${ra.valorTotal}"></td>`;
            bodyHTML += `<td class="celda-oportunidad"><input type="number" class="input-oportunidad-simple" data-estudiante="${estudiante.id}" data-ra="${ra.id}" data-oportunidad="3" value="${calificacion.op3 || ''}" min="0" max="${ra.valorTotal}"></td>`;
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
    // Retorna el último valor registrado (prioridad: op3 > op2 > op1)
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
    // Eventos para cambiar valor total del RA
    document.querySelectorAll('.input-valor-ra').forEach(input => {
        input.addEventListener('change', function() {
            const raId = this.dataset.ra;
            const nuevoValor = parseFloat(this.value) || 0;
            
            // Actualizar el RA en el estado
            const ra = state.ras.find(r => r.id == raId);
            if (ra) {
                ra.valorTotal = nuevoValor;
            }
            
            // Recalcular y regenerar tabla
            generarTablaRegistro();
        });
    });
    
    // Eventos para oportunidades simples
    document.querySelectorAll('.input-oportunidad-simple').forEach(input => {
        // Permitir pegar desde Excel
        input.addEventListener('paste', function(e) {
            e.preventDefault();
            const pasteData = e.clipboardData.getData('text');
            const valor = parseFloat(pasteData.trim()) || '';
            this.value = valor;
            guardarCalificacion(this);
        });
        
        input.addEventListener('input', function() {
            validarCalificacion(this);
        });
        
        input.addEventListener('change', function() {
            guardarCalificacion(this);
        });
    });
}

function agregarEventosInputsActividades() {
    document.querySelectorAll('.input-actividad').forEach(input => {
        input.addEventListener('input', function() {
            actualizarTotalActividades(this);
        });
    });
}

function actualizarTotalActividades(input) {
    const fila = input.closest('tr');
    const inputs = fila.querySelectorAll('.input-actividad');
    let total = 0;
    
    inputs.forEach(inp => {
        const valor = parseFloat(inp.value) || 0;
        total += valor;
    });
    
    const celdaTotal = fila.querySelector('.celda-total');
    if (celdaTotal) {
        celdaTotal.textContent = total.toFixed(2);
    }
    
    // Solo actualizar el estado local, NO guardar automáticamente
    const estudianteId = input.dataset.estudiante;
    const actividadNumero = input.dataset.actividad;
    const valor = parseFloat(input.value) || null;
    
    let act = state.actividades.find(a => a.estudianteId == estudianteId && a.numero == actividadNumero);
    if (!act) {
        act = { estudianteId, numero: actividadNumero, valor, raId: state.raSeleccionado };
        state.actividades.push(act);
    } else {
        act.valor = valor;
    }
}

function guardarTotalEnRegistroCalificaciones(estudianteId, total) {
    const raId = state.raSeleccionado;
    
    // Buscar si ya existe una calificación para este estudiante y RA
    let calificacion = state.calificaciones.find(c => c.estudianteId == estudianteId && c.raId == raId);
    
    if (calificacion) {
        // Actualizar oportunidad 1
        calificacion.op1 = total;
    } else {
        // Crear nueva calificación
        calificacion = {
            id: Date.now(),
            estudianteId: estudianteId,
            raId: raId,
            op1: total,
            op2: null,
            op3: null
        };
        state.calificaciones.push(calificacion);
    }
    
    // Actualizar la tabla de registro si está visible
    actualizarTotales();
    
    console.log(`Total de actividades (${total}) guardado en oportunidad 1 del RA ${raId} para estudiante ${estudianteId}`);
}

function validarCalificacion(input) {
    const estudianteId = input.dataset.estudiante;
    const raId = input.dataset.ra;
    const oportunidad = input.dataset.oportunidad;
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
            actualizarTotales();
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
        actualizarTotales();
    }
}

// Nueva función para actualizar solo los totales sin regenerar toda la tabla
function actualizarTotales() {
    const filas = elementos.tablaRegistroBody.querySelectorAll('tr');
    
    filas.forEach((fila, index) => {
        const estudiante = state.estudiantes[index];
        if (!estudiante) return;
        
        let totalEstudiante = 0;
        
        state.ras.forEach((ra, raIndex) => {
            const calificacion = obtenerCalificacion(estudiante.id, ra.id);
            const valorFinal = obtenerUltimoValor(calificacion);
            totalEstudiante += valorFinal;
        });
        
        // Actualizar celda total (última celda)
        const celdaTotal = fila.cells[fila.cells.length - 1];
        if (celdaTotal) {
            celdaTotal.textContent = totalEstudiante;
        }
    });
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
        }
    } catch (error) {
        console.error('Error al guardar actividad:', error);
        // Actualizar estado local aunque falle el guardado en servidor
        let act = state.actividades.find(a => a.estudianteId == estudianteId && a.numero == actividadNumero);
        if (!act) {
            act = { estudianteId, numero: actividadNumero, valor };
            state.actividades.push(act);
        } else {
            act.valor = valor;
        }
    }
}

function mostrarCargando(mostrar) {
    elementos.loading.style.display = mostrar ? 'block' : 'none';
}

// Funciones de guardado masivo
async function guardarTodasLasActividades() {
    elementos.btnGuardarActividades.disabled = true;
    elementos.btnGuardarActividades.textContent = '⏳ Guardando...';
    
    try {
        // Guardar todas las actividades del RA actual
        for (const estudiante of state.estudiantes) {
            let totalEstudiante = 0;
            
            for (let i = 1; i <= CONFIG.NUM_ACTIVIDADES; i++) {
                const actividad = state.actividades.find(a => 
                    a.estudianteId == estudiante.id && 
                    a.numero == i && 
                    a.raId == state.raSeleccionado
                );
                
                if (actividad && actividad.valor !== null) {
                    totalEstudiante += actividad.valor;
                    // Aquí iría el guardado en servidor cuando esté configurado
                }
            }
            
            // Guardar el total en oportunidad 1 del registro de calificaciones
            guardarTotalEnRegistroCalificaciones(estudiante.id, totalEstudiante);
        }
        
        elementos.btnGuardarActividades.textContent = '✅ Guardado';
        setTimeout(() => {
            elementos.btnGuardarActividades.textContent = '💾 Guardar';
            elementos.btnGuardarActividades.disabled = false;
        }, 2000);
        
        console.log('Todas las actividades guardadas correctamente');
    } catch (error) {
        console.error('Error al guardar actividades:', error);
        elementos.btnGuardarActividades.textContent = '❌ Error';
        setTimeout(() => {
            elementos.btnGuardarActividades.textContent = '💾 Guardar';
            elementos.btnGuardarActividades.disabled = false;
        }, 2000);
    }
}

async function guardarTodoElRegistro() {
    elementos.btnGuardarRegistro.disabled = true;
    elementos.btnGuardarRegistro.textContent = '⏳ Guardando...';
    
    try {
        // Aquí iría el guardado de todas las calificaciones del registro
        // Por ahora solo actualizamos el estado local
        console.log('Registro guardado:', state.calificaciones);
        
        elementos.btnGuardarRegistro.textContent = '✅ Guardado';
        setTimeout(() => {
            elementos.btnGuardarRegistro.textContent = '💾 Guardar';
            elementos.btnGuardarRegistro.disabled = false;
        }, 2000);
    } catch (error) {
        console.error('Error al guardar registro:', error);
        elementos.btnGuardarRegistro.textContent = '❌ Error';
        setTimeout(() => {
            elementos.btnGuardarRegistro.textContent = '💾 Guardar';
            elementos.btnGuardarRegistro.disabled = false;
        }, 2000);
    }
}
