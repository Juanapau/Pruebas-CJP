// Configuración
const CONFIG = {
    // URL del Web App de Google Apps Script
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
    raSeleccionado: null,
    cursoSeleccionado: null,
    // Sistema de caché
    cache: {
        modulos: { data: null, timestamp: null },
        ras: {},  // Por moduloId
        estudiantes: {},  // Por curso
        calificaciones: {},  // Por moduloId
        actividades: {}  // Por raId
    },
    CACHE_DURATION: 5 * 60 * 1000  // 5 minutos
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
    // Intentar cargar desde caché primero
    const cached = obtenerDeCache('modulos');
    if (cached) {
        state.modulos = cached;
        poblarSelectModulos();
        return;
    }
    
    // Si no hay caché, cargar desde Google Sheets
    console.time('⏱️ Carga de Módulos (Sheets)');
    try {
        const response = await fetch(`${CONFIG.GOOGLE_SCRIPT_URL}?action=getModulos`);
        const data = await response.json();
        state.modulos = data.modulos || [];
        
        // Guardar en caché
        guardarEnCache('modulos', state.modulos);
        
        console.timeEnd('⏱️ Carga de Módulos (Sheets)');
        console.log('✅ Módulos cargados desde Google Sheets:', state.modulos.length);
        poblarSelectModulos();
    } catch (error) {
        console.error('❌ ERROR al cargar módulos desde Google Sheets:', error);
        alert('Error al cargar los módulos. Verifica la conexión con Google Sheets.');
        state.modulos = [];
        poblarSelectModulos();
    }
}

async function cargarEstudiantes(curso) {
    // Intentar cargar desde caché
    const cached = obtenerDeCache('estudiantes', curso);
    if (cached) {
        state.estudiantes = cached;
        return;
    }
    
    // Cargar desde Sheets
    console.time(`⏱️ Carga de Estudiantes ${curso} (Sheets)`);
    try {
        const response = await fetch(`${CONFIG.GOOGLE_SCRIPT_URL}?action=getEstudiantes&curso=${curso}`);
        const data = await response.json();
        state.estudiantes = data.estudiantes || [];
        
        // Guardar en caché
        guardarEnCache('estudiantes', state.estudiantes, curso);
        
        console.timeEnd(`⏱️ Carga de Estudiantes ${curso} (Sheets)`);
        console.log(`✅ Estudiantes de ${curso} cargados desde Google Sheets:`, state.estudiantes.length);
    } catch (error) {
        console.error(`❌ ERROR al cargar estudiantes de ${curso}:`, error);
        alert('Error al cargar los estudiantes. Verifica la conexión con Google Sheets.');
        state.estudiantes = [];
    }
}

async function cargarRAsDelModulo(moduloId) {
    // Intentar cargar desde caché
    const cached = obtenerDeCache('ras', moduloId);
    if (cached) {
        state.ras = cached;
        poblarSelectRAs();
        return;
    }
    
    // Cargar desde Sheets
    console.time('⏱️ Carga de RAs (Sheets)');
    mostrarCargando(true);
    try {
        const response = await fetch(`${CONFIG.GOOGLE_SCRIPT_URL}?action=getRAs&moduloId=${moduloId}`);
        const data = await response.json();
        state.ras = data.ras || [];
        
        // Guardar en caché
        guardarEnCache('ras', state.ras, moduloId);
        
        console.timeEnd('⏱️ Carga de RAs (Sheets)');
        console.log(`✅ RAs cargados desde Google Sheets (Módulo ${moduloId}):`, state.ras.length);
        poblarSelectRAs();
    } catch (error) {
        console.error('❌ ERROR al cargar RAs desde Google Sheets:', error);
        alert('Error al cargar los RAs. Verifica la conexión con Google Sheets.');
        state.ras = [];
        poblarSelectRAs();
    } finally {
        mostrarCargando(false);
    }
}

async function cargarCalificaciones(moduloId) {
    // Intentar cargar desde caché
    const cached = obtenerDeCache('calificaciones', moduloId);
    if (cached) {
        state.calificaciones = cached;
        generarTablaRegistro();
        return;
    }
    
    // Cargar desde Sheets
    console.time('⏱️ Carga de Calificaciones (Sheets)');
    mostrarCargando(true);
    try {
        const response = await fetch(`${CONFIG.GOOGLE_SCRIPT_URL}?action=getCalificaciones&moduloId=${moduloId}`);
        const data = await response.json();
        state.calificaciones = data.calificaciones || [];
        
        // Guardar en caché
        guardarEnCache('calificaciones', state.calificaciones, moduloId);
        
        console.timeEnd('⏱️ Carga de Calificaciones (Sheets)');
        console.log(`📊 ${state.calificaciones.length} calificaciones cargadas`);
        generarTablaRegistro();
    } catch (error) {
        console.error('Error al cargar calificaciones:', error);
        state.calificaciones = [];
        generarTablaRegistro();
    } finally {
        mostrarCargando(false);
    }
}

async function cargarActividadesRA(raId) {
    // Intentar cargar desde caché
    const cached = obtenerDeCache('actividades', raId);
    if (cached) {
        // Eliminar actividades anteriores de este RA y agregar las del caché
        state.actividades = state.actividades.filter(a => a.raId != raId);
        state.actividades.push(...cached);
        generarTablaActividades();
        return;
    }
    
    // Cargar desde Sheets
    console.time('⏱️ Carga de Actividades (Sheets)');
    mostrarCargando(true);
    try {
        const response = await fetch(`${CONFIG.GOOGLE_SCRIPT_URL}?action=getActividades&raId=${raId}`);
        const data = await response.json();
        
        const actividadesDelRA = data.actividades || [];
        
        // Guardar en caché
        guardarEnCache('actividades', actividadesDelRA, raId);
        
        // Eliminar actividades anteriores de este RA y agregar las nuevas
        state.actividades = state.actividades.filter(a => a.raId != raId);
        state.actividades.push(...actividadesDelRA);
        
        console.timeEnd('⏱️ Carga de Actividades (Sheets)');
        console.log(`📋 ${actividadesDelRA.length} actividades cargadas de Google Sheets`);
        generarTablaActividades();
    } catch (error) {
        console.error('Error al cargar actividades:', error);
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
        
        // OPTIMIZACIÓN: Cargar RAs y Calificaciones en paralelo (más rápido)
        await Promise.all([
            cargarRAsDelModulo(moduloId),
            cargarCalificaciones(moduloId)
        ]);
        
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
        // Obtener el módulo actual
        const moduloActual = state.modulos.find(m => m.id == state.moduloSeleccionado);
        const nombreModulo = moduloActual ? moduloActual.nombre : '';
        
        elementos.tituloActividades.textContent = `Actividades del ${raActual.codigo}`;
        
        // Agregar nombre del módulo si existe
        if (nombreModulo) {
            elementos.tituloActividades.innerHTML = `
                Actividades del ${raActual.codigo}
                <span class="modulo-info">Módulo: ${nombreModulo}</span>
            `;
        }
        
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
    
    // Aplicar validación de colores a TODOS los inputs (incluyendo los cargados de BD)
    aplicarValidacionColoresATodos();
}


function generarTablaActividades() {
    const raActual = state.ras.find(ra => ra.id == state.raSeleccionado);
    if (!raActual) return;
    
    // Generar encabezado
    let headerHTML = '<tr>';
    headerHTML += '<th>No.</th>';
    headerHTML += '<th>Nombres</th>';
    
    for (let i = 1; i <= CONFIG.NUM_ACTIVIDADES; i++) {
        headerHTML += `<th class="actividad-header">Ac.${i}</th>`;
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
            bodyHTML += `<td><input type="number" class="input-actividad" data-estudiante="${estudiante.id}" data-actividad="${i}" data-ra="${state.raSeleccionado}" value="${valor || ''}" min="0" max="10"></td>`;
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
    const actividad = state.actividades.find(a => 
        a.estudianteId == estudianteId && 
        a.numero == actividadNumero && 
        a.raId == state.raSeleccionado
    );
    return actividad ? actividad.valor : null;
}

function obtenerDescripcionActividad(numero) {
    const descripcion = state.actividades.find(a => 
        a.numero == numero && 
        a.estudianteId == 0 && 
        a.raId == state.raSeleccionado
    );
    return descripcion ? descripcion.descripcion : `Actividad ${numero}`;
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
    const raId = input.dataset.ra || state.raSeleccionado;
    const valor = parseFloat(input.value) || null;
    
    let act = state.actividades.find(a => 
        a.estudianteId == estudianteId && 
        a.numero == actividadNumero && 
        a.raId == raId
    );
    if (!act) {
        act = { estudianteId, numero: actividadNumero, valor, raId: raId };
        state.actividades.push(act);
    } else {
        act.valor = valor;
    }
}

async function guardarTotalEnRegistroCalificaciones(estudianteId, total) {
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
    
    // Guardar en Google Sheets
    try {
        const response = await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'guardarCalificacion',
                estudianteId: estudianteId,
                raId: raId,
                oportunidad: 1,
                valor: total
            })
        });
        
        const result = await response.json();
        if (result.success) {
            console.log(`Total (${total}) guardado en Google Sheets - RA ${raId}, Estudiante ${estudianteId}`);
        }
    } catch (error) {
        console.error('Error al guardar total en Google Sheets:', error);
    }
    
    // Actualizar la tabla de registro si está visible
    actualizarTotales();
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
        // Recopilar todas las actividades a guardar
        let actividadesAGuardar = [];
        let totalesPorEstudiante = {};
        
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
                    
                    // Agregar al array para guardar en lote
                    actividadesAGuardar.push({
                        raId: state.raSeleccionado,
                        estudianteId: estudiante.id,
                        actividadNumero: i,
                        valor: actividad.valor
                    });
                }
            }
            
            totalesPorEstudiante[estudiante.id] = totalEstudiante;
        }
        
        // OPTIMIZACIÓN: 1 sola petición para TODAS las actividades
        if (actividadesAGuardar.length > 0) {
            const response = await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'guardarTodasActividades',
                    actividades: actividadesAGuardar
                })
            });
            
            const result = await response.json();
            if (result.success) {
                console.log(`✅ ${result.count} actividades guardadas en Google Sheets`);
            }
        }
        
        // Guardar totales en calificaciones (también por lotes)
        let calificacionesAGuardar = [];
        for (const estudiante of state.estudiantes) {
            const total = totalesPorEstudiante[estudiante.id] || 0;
            if (total > 0) {
                calificacionesAGuardar.push({
                    estudianteId: estudiante.id,
                    raId: state.raSeleccionado,
                    oportunidad: 1,
                    valor: total
                });
                
                // Actualizar estado local
                let calificacion = state.calificaciones.find(c => 
                    c.estudianteId == estudiante.id && c.raId == state.raSeleccionado
                );
                if (calificacion) {
                    calificacion.op1 = total;
                } else {
                    state.calificaciones.push({
                        id: Date.now(),
                        estudianteId: estudiante.id,
                        raId: state.raSeleccionado,
                        op1: total,
                        op2: null,
                        op3: null
                    });
                }
            }
        }
        
        // Guardar calificaciones por lotes
        if (calificacionesAGuardar.length > 0) {
            const response = await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'guardarTodoRegistro',
                    calificaciones: calificacionesAGuardar
                })
            });
            
            const result = await response.json();
            if (result.success) {
                console.log(`✅ ${result.count} calificaciones guardadas en Google Sheets`);
            }
        }
        
        elementos.btnGuardarActividades.textContent = '✅ Guardado';
        
        // Invalidar caché de actividades y calificaciones
        invalidarCache('actividades', state.raSeleccionado);
        invalidarCache('calificaciones', state.moduloSeleccionado);
        
        setTimeout(() => {
            elementos.btnGuardarActividades.textContent = '💾 Guardar';
            elementos.btnGuardarActividades.disabled = false;
        }, 2000);
        
        console.log('✅ Todas las actividades y totales guardados correctamente');
    } catch (error) {
        console.error('❌ Error al guardar actividades:', error);
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
        // Recopilar todos los valores de los inputs
        const inputs = document.querySelectorAll('.input-oportunidad-simple');
        let calificacionesAGuardar = [];
        
        for (const input of inputs) {
            const estudianteId = input.dataset.estudiante;
            const raId = input.dataset.ra;
            const oportunidad = input.dataset.oportunidad;
            const valor = parseFloat(input.value) || null;
            
            if (valor !== null) {
                // Actualizar estado local
                let calificacion = state.calificaciones.find(c => 
                    c.estudianteId == estudianteId && c.raId == raId
                );
                
                if (!calificacion) {
                    calificacion = {
                        id: Date.now(),
                        estudianteId: estudianteId,
                        raId: raId,
                        op1: null,
                        op2: null,
                        op3: null
                    };
                    state.calificaciones.push(calificacion);
                }
                
                // Actualizar la oportunidad correspondiente
                if (oportunidad == 1) calificacion.op1 = valor;
                else if (oportunidad == 2) calificacion.op2 = valor;
                else if (oportunidad == 3) calificacion.op3 = valor;
                
                // Agregar al array para guardar por lotes
                calificacionesAGuardar.push({
                    estudianteId: estudianteId,
                    raId: raId,
                    oportunidad: parseInt(oportunidad),
                    valor: valor
                });
            }
        }
        
        // OPTIMIZACIÓN: 1 sola petición para TODAS las calificaciones
        if (calificacionesAGuardar.length > 0) {
            const response = await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'guardarTodoRegistro',
                    moduloId: state.moduloSeleccionado,  // Agregar moduloId para calcular totales
                    calificaciones: calificacionesAGuardar
                })
            });
            
            const result = await response.json();
            if (result.success) {
                console.log(`✅ ${result.count} calificaciones guardadas en Google Sheets`);
            }
        }
        
        elementos.btnGuardarRegistro.textContent = '✅ Guardado';
        
        // Invalidar caché de calificaciones
        invalidarCache('calificaciones', state.moduloSeleccionado);
        
        setTimeout(() => {
            elementos.btnGuardarRegistro.textContent = '💾 Guardar';
            elementos.btnGuardarRegistro.disabled = false;
        }, 2000);
        
        console.log('✅ Registro completo guardado en Google Sheets');
    } catch (error) {
        console.error('❌ Error al guardar registro:', error);
        elementos.btnGuardarRegistro.textContent = '❌ Error';
        setTimeout(() => {
            elementos.btnGuardarRegistro.textContent = '💾 Guardar';
            elementos.btnGuardarRegistro.disabled = false;
        }, 2000);
    }
}

// Eventos para edición de descripciones de actividades
function agregarEventosDescripcionesActividades() {
    document.querySelectorAll('.actividad-header').forEach(header => {
        const actividadNumero = header.dataset.actividad;
        const titulo = header.querySelector('.actividad-titulo');
        const textarea = header.querySelector('.input-descripcion');
        const tooltip = header.querySelector('.tooltip-descripcion');
        
        // Click en el título para editar
        titulo.addEventListener('click', function(e) {
            e.stopPropagation();
            titulo.style.display = 'none';
            tooltip.style.display = 'none';
            textarea.style.display = 'block';
            textarea.focus();
            textarea.select();
        });
        
        // Guardar al hacer clic fuera o presionar Enter
        textarea.addEventListener('blur', function() {
            guardarDescripcionActividad(actividadNumero, textarea.value);
        });
        
        textarea.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                textarea.blur();
            }
            if (e.key === 'Escape') {
                textarea.blur();
            }
        });
        
        // Prevenir que se cierre al hacer clic dentro del textarea
        textarea.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    });
}

async function guardarDescripcionActividad(actividadNumero, descripcion) {
    try {
        // Guardar en Google Sheets
        const response = await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'guardarDescripcionActividad',
                raId: state.raSeleccionado,
                actividadNumero: actividadNumero,
                descripcion: descripcion
            })
        });
        
        const result = await response.json();
        if (result.success) {
            console.log(`✅ Descripción de Actividad ${actividadNumero} guardada`);
            // Recargar la tabla para actualizar el tooltip
            generarTablaActividades();
        }
    } catch (error) {
        console.error('Error al guardar descripción:', error);
        // Recargar de todos modos para restaurar el estado
        generarTablaActividades();
    }
}

// Aplicar validación de colores a todos los inputs al cargar
function aplicarValidacionColoresATodos() {
    document.querySelectorAll('.input-oportunidad-simple').forEach(input => {
        validarCalificacion(input);
    });
}

// ==========================================
// SISTEMA DE CACHÉ
// ==========================================

function esCacheValido(timestamp) {
    if (!timestamp) return false;
    const ahora = Date.now();
    return (ahora - timestamp) < state.CACHE_DURATION;
}

function obtenerDeCache(tipo, clave = null) {
    if (tipo === 'modulos') {
        const cache = state.cache.modulos;
        if (esCacheValido(cache.timestamp)) {
            console.log('✨ Módulos cargados desde CACHÉ (instantáneo)');
            return cache.data;
        }
    } else {
        const cache = state.cache[tipo][clave];
        if (cache && esCacheValido(cache.timestamp)) {
            console.log(`✨ ${tipo} cargados desde CACHÉ (instantáneo)`);
            return cache.data;
        }
    }
    return null;
}

function guardarEnCache(tipo, data, clave = null) {
    if (tipo === 'modulos') {
        state.cache.modulos = {
            data: data,
            timestamp: Date.now()
        };
    } else {
        state.cache[tipo][clave] = {
            data: data,
            timestamp: Date.now()
        };
    }
}

function invalidarCache(tipo = null, clave = null) {
    if (!tipo) {
        // Invalidar todo el caché
        state.cache = {
            modulos: { data: null, timestamp: null },
            ras: {},
            estudiantes: {},
            calificaciones: {},
            actividades: {}
        };
        console.log('🗑️ Caché completo invalidado');
    } else if (tipo && !clave) {
        // Invalidar todo un tipo
        if (tipo === 'modulos') {
            state.cache.modulos = { data: null, timestamp: null };
        } else {
            state.cache[tipo] = {};
        }
        console.log(`🗑️ Caché de ${tipo} invalidado`);
    } else {
        // Invalidar una clave específica
        if (state.cache[tipo][clave]) {
            delete state.cache[tipo][clave];
            console.log(`🗑️ Caché de ${tipo}[${clave}] invalidado`);
        }
    }
}
