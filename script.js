// Configuración
const CONFIG = {
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
    cargarPreferenciaModoOscuro();
    inicializarEventos();
    cargarDatosIniciales();
    optimizarParaMovil();
    inicializarNavegacionHorizontal();
});

function inicializarEventos() {
    elementos.selectCurso.addEventListener('change', manejarCambioCurso);
    elementos.selectModulo.addEventListener('change', manejarCambioModulo);
    elementos.selectRA.addEventListener('change', manejarCambioRA);
    elementos.btnVolverRegistro.addEventListener('click', volverARegistro);
    elementos.btnGuardarRegistro.addEventListener('click', guardarTodoElRegistro);
    elementos.btnGuardarActividades.addEventListener('click', guardarTodasLasActividades);
    
    // Modo oscuro
    const btnModoOscuro = document.getElementById('btnModoOscuro');
    if (btnModoOscuro) {
        btnModoOscuro.addEventListener('click', toggleModoOscuro);
    }
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
    const cached = obtenerDeCache('modulos');
    if (cached) {
        state.modulos = cached;
        poblarSelectModulos();
        return;
    }
    mostrarCargando(true, 'Cargando módulos...');
    try {
        const response = await fetchConTimeout(`${CONFIG.GOOGLE_SCRIPT_URL}?action=getModulos`);
        const data = await response.json();
        state.modulos = data.modulos || [];
        guardarEnCache('modulos', state.modulos);
        poblarSelectModulos();
    } catch (error) {
        console.error('❌ ERROR al cargar módulos:', error);
        state.modulos = [];
        poblarSelectModulos();
    } finally {
        mostrarCargando(false);
    }
}

async function cargarEstudiantes(curso) {
    const cached = obtenerDeCache('estudiantes', curso);
    if (cached) {
        state.estudiantes = cached;
        return;
    }
    mostrarCargando(true, `Cargando estudiantes de ${curso}...`);
    try {
        const response = await fetchConTimeout(`${CONFIG.GOOGLE_SCRIPT_URL}?action=getEstudiantes&curso=${curso}`);
        const data = await response.json();
        state.estudiantes = data.estudiantes || [];
        guardarEnCache('estudiantes', state.estudiantes, curso);
    } catch (error) {
        console.error(`❌ ERROR al cargar estudiantes de ${curso}:`, error);
        state.estudiantes = [];
    } finally {
        mostrarCargando(false);
    }
}

async function cargarRAsDelModulo(moduloId) {
    const cached = obtenerDeCache('ras', moduloId);
    if (cached) {
        state.ras = cached;
        poblarSelectRAs();
        return;
    }
    mostrarCargando(true, 'Cargando resultados de aprendizaje...');
    try {
        const response = await fetchConTimeout(`${CONFIG.GOOGLE_SCRIPT_URL}?action=getRAs&moduloId=${moduloId}`);
        const data = await response.json();
        state.ras = data.ras || [];
        guardarEnCache('ras', state.ras, moduloId);
        poblarSelectRAs();
    } catch (error) {
        console.error('❌ ERROR al cargar RAs:', error);
        alert('Error al cargar los RAs. Verifica tu conexión e intenta de nuevo.');
        state.ras = [];
        poblarSelectRAs();
    } finally {
        mostrarCargando(false);
    }
}

async function cargarCalificaciones(moduloId) {
    const cached = obtenerDeCache('calificaciones', moduloId);
    if (cached) {
        state.calificaciones = cached;
        generarTablaRegistro();
        return;
    }
    mostrarCargando(true, 'Cargando calificaciones...');
    try {
        const response = await fetchConTimeout(`${CONFIG.GOOGLE_SCRIPT_URL}?action=getCalificaciones&moduloId=${moduloId}`);
        const data = await response.json();
        state.calificaciones = data.calificaciones || [];
        guardarEnCache('calificaciones', state.calificaciones, moduloId);
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
    const cached = obtenerDeCache('actividades', raId);
    if (cached) {
        state.actividades = state.actividades.filter(a => a.raId != raId);
        state.actividades.push(...cached);
        // Cargar descripciones con moduloId
        await cargarDescripcionesActividades(state.moduloSeleccionado, raId);
        generarTablaActividades();
        return;
    }
    mostrarCargando(true, 'Cargando actividades del RA...');
    try {
        const response = await fetchConTimeout(`${CONFIG.GOOGLE_SCRIPT_URL}?action=getActividades&raId=${raId}`);
        const data = await response.json();
        const actividadesDelRA = data.actividades || [];
        guardarEnCache('actividades', actividadesDelRA, raId);
        state.actividades = state.actividades.filter(a => a.raId != raId);
        state.actividades.push(...actividadesDelRA);
        // Cargar descripciones con moduloId
        await cargarDescripcionesActividades(state.moduloSeleccionado, raId);
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
    
    // Agregar opción de asistencia
    if (typeof agregarOpcionAsistencia === 'function') {
        agregarOpcionAsistencia();
    }
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
        try {
            // Cargar RAs y Calificaciones en paralelo
            await Promise.all([
                cargarRAsDelModulo(moduloId),
                cargarCalificaciones(moduloId)
            ]);
        } catch (error) {
            console.error('Error al cargar módulo:', error);
        } finally {
            mostrarCargando(false); // Garantiza que siempre se cierre
        }
        elementos.btnGuardarRegistro.style.display = 'flex';
    } else {
        state.moduloSeleccionado = null;
        state.ras = [];
        elementos.selectRA.innerHTML = '<option value="">Seleccione un RA</option>';
        elementos.tablaRegistroHead.innerHTML = '';
        elementos.tablaRegistroBody.innerHTML = '';
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
    headerHTML += '<th rowspan="2" class="header-numero">#</th>';
    headerHTML += '<th rowspan="2" class="header-nombre">Nombre</th>';
    
    state.ras.forEach(ra => {
        // Cada RA ocupa 3 columnas (las 3 oportunidades)
        headerHTML += `<th colspan="3" class="header-ra separador-ra">%${ra.codigo}</th>`;
    });
    
    headerHTML += '<th rowspan="2" class="header-total">Total</th>';
    headerHTML += '</tr>';
    
    // Segunda fila: Celdas combinadas con estructura interna
    headerHTML += '<tr>';
    
    state.ras.forEach(ra => {
        const minimo = calcularMinimo(ra.valorTotal || 0);
        
        // Celda combinada negra (colspan 2) con valor y "Valor"
        headerHTML += `<th colspan="2" class="header-combinado separador-ra">
            <div class="combinado-container">
                <div class="combinado-negro">
                    <div class="combinado-negro-valor">
                        <input type="number" class="input-valor-ra" data-ra="${ra.id}" value="${ra.valorTotal || 0}" min="0" max="100">
                    </div>
                    <div class="combinado-negro-label">Valor</div>
                </div>
            </div>
        </th>`;
        
        // Celda combinada gris (colspan 1) con mínimo y "70%"
        headerHTML += `<th class="header-combinado">
            <div class="combinado-gris">
                <div class="combinado-gris-valor">${minimo}</div>
                <div class="combinado-gris-label">70%</div>
            </div>
        </th>`;
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
            
            // SOLO 3 celdas: las 3 oportunidades — primera lleva clase separador-ra
            bodyHTML += `<td class="celda-oportunidad separador-ra"><input type="number" class="input-oportunidad-simple" data-estudiante="${estudiante.id}" data-ra="${ra.id}" data-oportunidad="1" value="${calificacion.op1 !== null && calificacion.op1 !== undefined ? calificacion.op1 : ''}" min="0" max="${ra.valorTotal}"></td>`;
            bodyHTML += `<td class="celda-oportunidad"><input type="number" class="input-oportunidad-simple" data-estudiante="${estudiante.id}" data-ra="${ra.id}" data-oportunidad="2" value="${calificacion.op2 !== null && calificacion.op2 !== undefined ? calificacion.op2 : ''}" min="0" max="${ra.valorTotal}"></td>`;
            bodyHTML += `<td class="celda-oportunidad"><input type="number" class="input-oportunidad-simple" data-estudiante="${estudiante.id}" data-ra="${ra.id}" data-oportunidad="3" value="${calificacion.op3 !== null && calificacion.op3 !== undefined ? calificacion.op3 : ''}" min="0" max="${ra.valorTotal}"></td>`;
        });
        
        bodyHTML += `<td class="celda-total">${totalEstudiante}</td>`;
        bodyHTML += '</tr>';
    });
    
    elementos.tablaRegistroBody.innerHTML = bodyHTML;
    
    // Agregar eventos a los inputs
    agregarEventosInputsRegistro();
    
    // Aplicar validación de colores a TODOS los inputs (incluyendo los cargados de BD)
    aplicarValidacionColoresATodos();
    
    // Actualizar botones de navegación
    actualizarNavegacionTablas();
}


function generarTablaActividades() {
    const raActual = state.ras.find(ra => ra.id == state.raSeleccionado);
    if (!raActual) return;
    
    console.log('🎨 Generando tabla para RA:', state.raSeleccionado);
    console.log('📝 Descripciones disponibles:', descripcionesActividades);
    
    // Generar encabezado
    let headerHTML = '<tr>';
    headerHTML += '<th class="header-numero">No.</th>';
    headerHTML += '<th class="header-nombre">Nombres</th>';
    
    for (let i = 1; i <= CONFIG.NUM_ACTIVIDADES; i++) {
        const descripcion = descripcionesActividades[i] || '';
        console.log(`  Ac.${i}: ${descripcion ? '✅ Tiene descripción' : '❌ Sin descripción'}`);
        if (descripcion) {
            // Usar tooltip HTML real
            headerHTML += `
                <th class="actividad-header header-actividad">
                    Ac.${i}
                    <span class="info-icon">ℹ</span>
                    <div class="tooltip-bubble">${descripcion}</div>
                </th>`;
        } else {
            headerHTML += `<th class="actividad-header">Ac.${i}</th>`;
        }
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
            bodyHTML += `<td><input type="number" class="input-actividad" data-estudiante="${estudiante.id}" data-actividad="${i}" data-ra="${state.raSeleccionado}" value="${valor !== null && valor !== undefined ? valor : ''}" min="0" max="10"></td>`;
            totalActividades += valor || 0;
        }
        
        bodyHTML += `<td class="celda-total">${totalActividades.toFixed(2)}</td>`;
        bodyHTML += '</tr>';
    });
    
    elementos.tablaActividadesBody.innerHTML = bodyHTML;
    
    // Agregar eventos
    agregarEventosInputsActividades();
    
    // Actualizar botones de navegación
    actualizarNavegacionTablas();
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
        input.addEventListener('change', async function() {
            const raId = this.dataset.ra;
            const nuevoValor = parseFloat(this.value) || 0;
            
            // Actualizar el RA en el estado
            const ra = state.ras.find(r => r.id == raId);
            if (ra) {
                ra.valorTotal = nuevoValor;
            }
            
            // Guardar en Google Sheets usando GET (evita problemas de CORS)
            try {
                const url = `${CONFIG.GOOGLE_SCRIPT_URL}?action=actualizarValorRA&raId=${raId}&valorTotal=${nuevoValor}`;
                const response = await fetchConTimeout(url);
                const data = await response.json();
                
                if (data.success) {
                    console.log('✅ Valor del RA actualizado en Google Sheets');
                } else {
                    console.error('❌ Error al actualizar valor del RA:', data.error);
                }
            } catch (error) {
                console.error('❌ Error al guardar valor del RA:', error);
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

function mostrarCargando(mostrar, subtexto = 'Conectando con Google Sheets') {
    elementos.loading.style.display = mostrar ? 'flex' : 'none';
    const sub = document.getElementById('loadingSubtexto');
    if (sub) sub.textContent = subtexto;
}

// Fetch robusto compatible con Google Apps Script
async function fetchConTimeout(url) {
    return fetch(url);
}

// Funciones de guardado masivo
async function guardarTodasLasActividades() {
    elementos.btnGuardarActividades.disabled = true;
    elementos.btnGuardarActividades.textContent = '⏳ Guardando...';
    
    try {
        // Recopilar actividades DIRECTAMENTE de los inputs DOM (más confiable que state)
        const inputs = document.querySelectorAll('.input-actividad');
        let actividadesAGuardar = [];
        let totalesPorEstudiante = {};
        
        console.log(`📝 Leyendo ${inputs.length} inputs de actividades...`);
        
        inputs.forEach(input => {
            const estudianteId = input.dataset.estudiante;
            const actividadNumero = input.dataset.actividad;
            const raId = input.dataset.ra || state.raSeleccionado;
            const valor = parseFloat(input.value);
            
            if (!isNaN(valor) && valor >= 0) {
                // Guardar actividad
                actividadesAGuardar.push({
                    raId: raId,
                    estudianteId: estudianteId,
                    actividadNumero: actividadNumero,
                    valor: valor
                });
                
                // Actualizar state local
                let act = state.actividades.find(a => 
                    a.estudianteId == estudianteId && 
                    a.numero == actividadNumero && 
                    a.raId == raId
                );
                if (!act) {
                    state.actividades.push({
                        id: Date.now(),
                        estudianteId: estudianteId,
                        numero: actividadNumero,
                        valor: valor,
                        raId: raId
                    });
                } else {
                    act.valor = valor;
                }
                
                // Calcular total por estudiante
                if (!totalesPorEstudiante[estudianteId]) {
                    totalesPorEstudiante[estudianteId] = 0;
                }
                totalesPorEstudiante[estudianteId] += valor;
            }
        });
        
        console.log(`📦 Total de actividades a guardar: ${actividadesAGuardar.length}`);
        
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
        
        // NO recargar inmediatamente - confiar en los datos locales que acabamos de guardar
        console.log('✅ Datos guardados - caché invalidado para próxima carga');
        
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
        
        // NO recargar inmediatamente - confiar en los datos locales que acabamos de guardar
        console.log('✅ Registro guardado - caché invalidado para próxima carga');
        
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

// ==========================================
// COPIAR Y PEGAR DESDE EXCEL
// ==========================================

// Event listener global para paste - funciona en cualquier input
document.addEventListener('paste', function(e) {
    const target = e.target;
    
    // Solo procesar si es un input de calificación o actividad
    if (!target.matches('.input-oportunidad-simple') && !target.matches('.input-actividad')) {
        return;
    }
    
    e.preventDefault();
    
    // Obtener datos del clipboard
    const pastedData = (e.clipboardData || window.clipboardData).getData('text');
    if (!pastedData) return;
    
    // Parsear datos (separados por tabs y saltos de línea)
    const rows = pastedData.split(/\r?\n/).filter(row => row.trim());
    const parsedRows = rows.map(row => row.split('\t'));
    
    // Encontrar posición actual
    const currentCell = target.closest('td');
    if (!currentCell) return;
    
    const currentRow = currentCell.closest('tr');
    const tbody = currentRow.parentElement;
    const allRows = Array.from(tbody.querySelectorAll('tr'));
    const currentRowIndex = allRows.indexOf(currentRow);
    
    const allCellsInRow = Array.from(currentRow.querySelectorAll('td'));
    const currentCellIndex = allCellsInRow.indexOf(currentCell);
    
    console.log(`📋 Pegando datos: ${parsedRows.length} filas × ${parsedRows[0].length} columnas`);
    
    // Pegar datos en las celdas correspondientes
    parsedRows.forEach((rowData, rowOffset) => {
        const targetRowIndex = currentRowIndex + rowOffset;
        if (targetRowIndex >= allRows.length) return; // No hay más filas
        
        const targetRow = allRows[targetRowIndex];
        const cellsInTargetRow = Array.from(targetRow.querySelectorAll('td'));
        
        rowData.forEach((cellValue, colOffset) => {
            const targetCellIndex = currentCellIndex + colOffset;
            if (targetCellIndex >= cellsInTargetRow.length) return; // No hay más columnas
            
            const targetCell = cellsInTargetRow[targetCellIndex];
            const input = targetCell.querySelector('input[type="number"]');
            
            if (input) {
                const cleanValue = cellValue.trim().replace(/,/g, ''); // Quitar comas
                const numericValue = parseFloat(cleanValue);
                
                if (!isNaN(numericValue) && numericValue >= 0) {
                    input.value = numericValue;
                    
                    // Disparar evento change para actualizar validaciones
                    const event = new Event('change', { bubbles: true });
                    input.dispatchEvent(event);
                    
                    // Validar si es input de calificación
                    if (input.classList.contains('input-oportunidad-simple')) {
                        validarCalificacion(input);
                    }
                    
                    // Actualizar total si es input de actividad
                    if (input.classList.contains('input-actividad')) {
                        actualizarTotalActividades(input);
                    }
                }
            }
        });
    });
    
    console.log('✅ Datos pegados correctamente');
});

// ==========================================
// OPTIMIZACIONES PARA MÓVIL
// ==========================================

// Detectar dispositivo móvil
function esDispositivoMovil() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Ajustar interfaz según dispositivo
function optimizarParaMovil() {
    if (esDispositivoMovil()) {
        document.body.classList.add('mobile-device');
        console.log('📱 Modo móvil activado');
        
        // Agregar indicador de scroll en tablas
        const tablas = document.querySelectorAll('.tabla-scroll');
        tablas.forEach(tabla => {
            tabla.addEventListener('scroll', function() {
                if (this.scrollLeft > 10) {
                    this.classList.add('scrolled');
                } else {
                    this.classList.remove('scrolled');
                }
            });
        });
    }
}

// Prevenir zoom accidental en iOS al hacer doble tap
let lastTouchEnd = 0;
document.addEventListener('touchend', function(event) {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        event.preventDefault();
    }
    lastTouchEnd = now;
}, false);

// Optimizar al cargar
document.addEventListener('DOMContentLoaded', () => {
    cargarPreferenciaModoOscuro();
    optimizarParaMovil();
});
window.addEventListener('orientationchange', function() {
    setTimeout(() => {
        // Reajustar tablas después de cambio de orientación
        const tablas = document.querySelectorAll('table');
        tablas.forEach(tabla => {
            tabla.style.minWidth = window.innerWidth < 768 ? '800px' : '100%';
        });
    }, 100);
});

// ==========================================
// MODO OSCURO
// ==========================================

// Cargar preferencia guardada al iniciar
function cargarPreferenciaModoOscuro() {
    const modoOscuro = localStorage.getItem('modoOscuro') === 'true';
    if (modoOscuro) {
        document.body.classList.add('dark-mode');
    }
}

// Cambiar modo oscuro
function toggleModoOscuro() {
    document.body.classList.toggle('dark-mode');
    const esModoOscuro = document.body.classList.contains('dark-mode');
    
    // Guardar preferencia
    localStorage.setItem('modoOscuro', esModoOscuro);
    
    // Log
    console.log(esModoOscuro ? '🌙 Modo oscuro activado' : '☀️ Modo claro activado');
}

// Modo oscuro se inicializa en inicializarEventos()

// Modo oscuro se carga automáticamente en el DOMContentLoaded principal

// ==========================================
// NAVEGACIÓN HORIZONTAL CON BOTONES FLOTANTES
// ==========================================

function inicializarNavegacionHorizontal() {
    // Configurar para ambas tablas
    configurarNavegacion('tablaScrollRegistro', 'scrollLeftRegistro', 'scrollRightRegistro');
    configurarNavegacion('tablaScrollActividades', 'scrollLeftActividades', 'scrollRightActividades');
}

function configurarNavegacion(contenedorId, btnLeftId, btnRightId) {
    const contenedor = document.getElementById(contenedorId);
    const btnLeft = document.getElementById(btnLeftId);
    const btnRight = document.getElementById(btnRightId);
    
    if (!contenedor || !btnLeft || !btnRight) return;
    
    let animacionId = null;
    const VELOCIDAD = 3; // px por frame — ajusta este valor para más/menos velocidad
    
    // Función para actualizar visibilidad de botones
    function actualizarBotones() {
        const scrollLeft = contenedor.scrollLeft;
        const maxScroll = contenedor.scrollWidth - contenedor.clientWidth;
        
        if (scrollLeft > 10) {
            btnLeft.classList.add('visible');
        } else {
            btnLeft.classList.remove('visible');
        }
        
        if (scrollLeft < maxScroll - 10) {
            btnRight.classList.add('visible');
        } else {
            btnRight.classList.remove('visible');
        }
    }
    
    // Scroll continuo mientras el mouse esté encima
    function iniciarScrollContinuo(direccion) {
        if (animacionId) return; // Ya hay una animación corriendo
        
        function paso() {
            const maxScroll = contenedor.scrollWidth - contenedor.clientWidth;
            
            if (direccion === 'left') {
                if (contenedor.scrollLeft <= 0) {
                    detenerScroll();
                    return;
                }
                contenedor.scrollLeft -= VELOCIDAD;
            } else {
                if (contenedor.scrollLeft >= maxScroll) {
                    detenerScroll();
                    return;
                }
                contenedor.scrollLeft += VELOCIDAD;
            }
            
            actualizarBotones();
            animacionId = requestAnimationFrame(paso);
        }
        
        animacionId = requestAnimationFrame(paso);
    }
    
    function detenerScroll() {
        if (animacionId) {
            cancelAnimationFrame(animacionId);
            animacionId = null;
        }
    }
    
    // Hover — iniciar y detener scroll continuo
    btnLeft.addEventListener('mouseenter', () => iniciarScrollContinuo('left'));
    btnLeft.addEventListener('mouseleave', detenerScroll);
    btnRight.addEventListener('mouseenter', () => iniciarScrollContinuo('right'));
    btnRight.addEventListener('mouseleave', detenerScroll);
    
    // También mantener el click para dispositivos táctiles
    btnLeft.addEventListener('click', () => {
        contenedor.scrollBy({ left: -300, behavior: 'smooth' });
    });
    btnRight.addEventListener('click', () => {
        contenedor.scrollBy({ left: 300, behavior: 'smooth' });
    });
    
    contenedor.addEventListener('scroll', actualizarBotones);
    window.addEventListener('resize', actualizarBotones);
    
    // Observer para detectar cambios en el contenido
    const observer = new MutationObserver(() => {
        setTimeout(actualizarBotones, 100);
    });
    
    observer.observe(contenedor, {
        childList: true,
        subtree: true,
        attributes: true
    });
    
    setTimeout(actualizarBotones, 100);
}

// Llamar después de generar tablas
function actualizarNavegacionTablas() {
    setTimeout(() => {
        const contenedorRegistro = document.getElementById('tablaScrollRegistro');
        const contenedorActividades = document.getElementById('tablaScrollActividades');
        
        if (contenedorRegistro) {
            contenedorRegistro.dispatchEvent(new Event('scroll'));
        }
        if (contenedorActividades) {
            contenedorActividades.dispatchEvent(new Event('scroll'));
        }
    }, 200);
}

// ==========================================
// MÓDULO DE ASISTENCIA
// ==========================================

const asistenciaState = {
    moduloSeleccionado: null,
    cursoSeleccionado: null,
    mesSeleccionado: null,
    estudiantes: [],
    asistencias: [],
    diasDelMes: []
};

const asistenciaElementos = {
    vistaAsistencia: document.getElementById('vistaAsistencia'),
    selectModulo: document.getElementById('selectModuloAsistencia'),
    selectCurso: document.getElementById('selectCursoAsistencia'),
    selectMes: document.getElementById('selectMesAsistencia'),
    tablaHead: document.getElementById('tablaAsistenciaHead'),
    tablaBody: document.getElementById('tablaAsistenciaBody'),
    btnGuardar: document.getElementById('btnGuardarAsistencia'),
    btnVolver: document.getElementById('btnVolverDesdeAsistencia')
};

function inicializarEventosAsistencia() {
    elementos.selectRA.addEventListener('change', function(e) {
        if (e.target.value === 'asistencia') {
            mostrarVistaAsistencia();
        }
    });
    
    asistenciaElementos.selectModulo.addEventListener('change', manejarCambioModuloAsistencia);
    asistenciaElementos.selectCurso.addEventListener('change', manejarCambioCursoAsistencia);
    asistenciaElementos.selectMes.addEventListener('change', manejarCambioMesAsistencia);
    asistenciaElementos.selectMes.addEventListener('input', manejarCambioMesAsistencia);
    asistenciaElementos.btnVolver.addEventListener('click', volverDesdeAsistencia);
    asistenciaElementos.btnGuardar.addEventListener('click', guardarAsistencia);
}

/* DESHABILITADO - Acceso a asistencia solo desde menú
function agregarOpcionAsistencia() {
    const optionAsistencia = document.createElement('option');
    optionAsistencia.value = 'asistencia';
    optionAsistencia.textContent = '📋 Ver Asistencia';
    elementos.selectRA.appendChild(optionAsistencia);
}
*/

function mostrarVistaAsistencia() {
    elementos.vistaRegistro.style.display = 'none';
    elementos.vistaActividades.style.display = 'none';
    asistenciaElementos.vistaAsistencia.style.display = 'block';
    poblarSelectModulosAsistencia();
    asistenciaElementos.selectModulo.value = '';
    asistenciaElementos.selectCurso.value = '';
    asistenciaElementos.selectMes.value = '';
    asistenciaElementos.tablaHead.innerHTML = '';
    asistenciaElementos.tablaBody.innerHTML = '';
}

function poblarSelectModulosAsistencia() {
    asistenciaElementos.selectModulo.innerHTML = '<option value="">Seleccione un módulo</option>';
    state.modulos.forEach(modulo => {
        const option = document.createElement('option');
        option.value = modulo.id;
        option.textContent = modulo.nombre;
        asistenciaElementos.selectModulo.appendChild(option);
    });
}

function volverDesdeAsistencia() {
    asistenciaElementos.vistaAsistencia.style.display = 'none';
    elementos.vistaRegistro.style.display = 'block';
    elementos.selectRA.value = '';
}

async function manejarCambioModuloAsistencia(e) {
    const moduloId = e.target.value;
    if (!moduloId) {
        asistenciaElementos.tablaHead.innerHTML = '';
        asistenciaElementos.tablaBody.innerHTML = '';
        return;
    }
    asistenciaState.moduloSeleccionado = moduloId;
    verificarYCargarAsistencia();
}

async function manejarCambioCursoAsistencia(e) {
    const curso = e.target.value;
    if (!curso) {
        asistenciaElementos.tablaHead.innerHTML = '';
        asistenciaElementos.tablaBody.innerHTML = '';
        return;
    }
    asistenciaState.cursoSeleccionado = curso;
    await cargarEstudiantesAsistencia(curso);
    verificarYCargarAsistencia();
}

async function manejarCambioMesAsistencia(e) {
    const mes = e.target.value;
    console.log('Mes seleccionado:', mes);
    if (!mes) {
        asistenciaElementos.tablaHead.innerHTML = '';
        asistenciaElementos.tablaBody.innerHTML = '';
        return;
    }
    asistenciaState.mesSeleccionado = mes;
    console.log('Estado asistencia:', {modulo: asistenciaState.moduloSeleccionado, curso: asistenciaState.cursoSeleccionado, mes: asistenciaState.mesSeleccionado});
    await verificarYCargarAsistencia();
}

async function verificarYCargarAsistencia() {
    if (!asistenciaState.moduloSeleccionado || !asistenciaState.cursoSeleccionado || !asistenciaState.mesSeleccionado) {
        return;
    }
    await cargarAsistenciasMes(asistenciaState.moduloSeleccionado, asistenciaState.cursoSeleccionado, asistenciaState.mesSeleccionado);
    generarTablaAsistencia();
}

async function cargarEstudiantesAsistencia(curso) {
    mostrarCargando(true, 'Cargando estudiantes...');
    try {
        const response = await fetchConTimeout(`${CONFIG.GOOGLE_SCRIPT_URL}?action=getEstudiantes&curso=${curso}`);
        const data = await response.json();
        asistenciaState.estudiantes = data.estudiantes || [];
    } catch (error) {
        console.error('Error al cargar estudiantes:', error);
        asistenciaState.estudiantes = [];
    } finally {
        mostrarCargando(false);
    }
}

async function cargarAsistenciasMes(moduloId, curso, mes) {
    console.log('Cargando asistencias:', {moduloId, curso, mes});
    mostrarCargando(true, 'Cargando asistencias...');
    try {
        const url = `${CONFIG.GOOGLE_SCRIPT_URL}?action=getAsistencias&moduloId=${moduloId}&curso=${curso}&mes=${mes}`;
        console.log('URL:', url);
        const response = await fetchConTimeout(url);
        const data = await response.json();
        console.log('Asistencias cargadas:', data);
        asistenciaState.asistencias = data.asistencias || [];
        console.log('Estado actualizado con', asistenciaState.asistencias.length, 'registros');
    } catch (error) {
        console.error('Error al cargar asistencias:', error);
        asistenciaState.asistencias = [];
    } finally {
        mostrarCargando(false);
    }
}

function generarDiasLaborables(mes) {
    const [year, month] = mes.split('-');
    const primerDia = new Date(year, parseInt(month) - 1, 1);
    const ultimoDia = new Date(year, parseInt(month), 0);
    const dias = [];
    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
        const fecha = new Date(year, parseInt(month) - 1, dia);
        const diaSemana = fecha.getDay();
        if (diaSemana !== 0 && diaSemana !== 6) {
            dias.push(dia);
        }
    }
    return dias;
}

function generarTablaAsistencia() {
    console.log('Generando tabla de asistencia...');
    console.log('Estudiantes:', asistenciaState.estudiantes.length);
    console.log('Asistencias guardadas:', asistenciaState.asistencias.length);
    if (!asistenciaState.mesSeleccionado || asistenciaState.estudiantes.length === 0) {
        console.log('No hay mes o estudiantes, limpiando tabla');
        asistenciaElementos.tablaHead.innerHTML = '';
        asistenciaElementos.tablaBody.innerHTML = '';
        return;
    }
    asistenciaState.diasDelMes = generarDiasLaborables(asistenciaState.mesSeleccionado);
    console.log('Días del mes:', asistenciaState.diasDelMes);
    let headerHTML = '<tr>';
    headerHTML += '<th class="header-numero">#</th>';
    headerHTML += '<th class="header-nombre">Nombre</th>';
    asistenciaState.diasDelMes.forEach((dia, index) => {
        const claseExtra = index === 0 ? ' separador-ra' : '';
        headerHTML += `<th class="header-dia${claseExtra}"><input type="number" value="${dia}" min="1" max="31" data-dia-index="${index}" class="input-dia-header"></th>`;
    });
    headerHTML += '<th class="header-total-asistencia">Total</th>';
    headerHTML += '<th class="header-porcentaje-asistencia">%</th>';
    headerHTML += '</tr>';
    asistenciaElementos.tablaHead.innerHTML = headerHTML;
    let bodyHTML = '';
    asistenciaState.estudiantes.forEach(estudiante => {
        bodyHTML += '<tr>';
        bodyHTML += `<td class="numero">${estudiante.numero}</td>`;
        bodyHTML += `<td class="nombre-estudiante">${estudiante.nombre}</td>`;
        asistenciaState.diasDelMes.forEach((dia, index) => {
            const asistencia = obtenerAsistencia(estudiante.id, dia);
            const claseExtra = index === 0 ? ' separador-ra' : '';
            bodyHTML += `<td class="celda-asistencia${claseExtra}"><input type="text" maxlength="1" data-estudiante="${estudiante.id}" data-dia="${dia}" value="${asistencia}" class="input-asistencia ${obtenerClaseEstado(asistencia)}"></td>`;
        });
        const totales = calcularTotalesAsistencia(estudiante.id);
        bodyHTML += `<td class="celda-total-asistencia">${totales.total}</td>`;
        bodyHTML += `<td class="celda-porcentaje-asistencia">${totales.porcentaje}%</td>`;
        bodyHTML += '</tr>';
    });
    asistenciaElementos.tablaBody.innerHTML = bodyHTML;
    agregarEventosAsistencia();
    configurarNavegacion('tablaScrollAsistencia', 'scrollLeftAsistencia', 'scrollRightAsistencia');
    
    // Actualizar resumen de días trabajados
    actualizarResumenDiasTrabajados();
}

function obtenerAsistencia(estudianteId, dia) {
    const asistencia = asistenciaState.asistencias.find(a => {
        const idMatch = String(a.estudianteId) === String(estudianteId);
        const diaMatch = Number(a.dia) === Number(dia);
        return idMatch && diaMatch;
    });
    if (asistencia) {
        console.log(`✓ Encontrada asistencia: Est=${estudianteId}, Dia=${dia}, Estado=${asistencia.estado}`);
    }
    return asistencia ? asistencia.estado : '';
}

function obtenerClaseEstado(estado) {
    const estadoUpper = estado.toUpperCase();
    if (estadoUpper === 'P') return 'presente';
    if (estadoUpper === 'E') return 'excusa';
    if (estadoUpper === 'A') return 'ausente';
    if (estadoUpper === 'F') return 'feriado';
    return '';
}

function calcularTotalesAsistencia(estudianteId) {
    let presentes = 0, excusas = 0, ausentes = 0, feriados = 0;
    asistenciaState.diasDelMes.forEach(dia => {
        const estado = obtenerAsistencia(estudianteId, dia).toUpperCase();
        if (estado === 'P') presentes++;
        else if (estado === 'E') excusas++;
        else if (estado === 'A') ausentes++;
        else if (estado === 'F') feriados++;
    });
    const excusasComoAusencias = Math.floor(excusas / 3);
    const total = presentes + (excusas - (excusasComoAusencias * 3));
    const diasValidos = asistenciaState.diasDelMes.length - feriados;
    const porcentaje = diasValidos > 0 ? Math.round((total / diasValidos) * 100) : 0;
    return {total, porcentaje};
}

function agregarEventosAsistencia() {
    document.querySelectorAll('.input-dia-header').forEach(input => {
        input.addEventListener('change', function() {
            const index = parseInt(this.dataset.diaIndex);
            const nuevoDia = parseInt(this.value);
            if (nuevoDia >= 1 && nuevoDia <= 31) {
                asistenciaState.diasDelMes[index] = nuevoDia;
                generarTablaAsistencia();
            }
        });
    });
    document.querySelectorAll('.input-asistencia').forEach(input => {
        input.addEventListener('input', function() {
            const valor = this.value.toUpperCase();
            const estudianteId = this.dataset.estudiante;
            const dia = parseInt(this.dataset.dia);
            if (valor && !['P', 'E', 'A', 'F'].includes(valor)) {
                this.value = '';
                return;
            }
            this.value = valor;
            this.className = 'input-asistencia ' + obtenerClaseEstado(valor);
            actualizarAsistenciaState(estudianteId, dia, valor);
            actualizarTotalesEstudiante(estudianteId);
            
            // Actualizar resumen de días trabajados
            actualizarResumenDiasTrabajados();
        });
    });
}

function actualizarAsistenciaState(estudianteId, dia, estado) {
    const index = asistenciaState.asistencias.findIndex(a => String(a.estudianteId) === String(estudianteId) && Number(a.dia) === Number(dia));
    if (index !== -1) {
        if (estado === '') {
            asistenciaState.asistencias.splice(index, 1);
        } else {
            asistenciaState.asistencias[index].estado = estado;
        }
    } else if (estado !== '') {
        asistenciaState.asistencias.push({estudianteId: estudianteId, mes: asistenciaState.mesSeleccionado, dia: dia, estado: estado});
    }
}

function actualizarTotalesEstudiante(estudianteId) {
    const totales = calcularTotalesAsistencia(estudianteId);
    const fila = document.querySelector(`input[data-estudiante="${estudianteId}"]`).closest('tr');
    const celdaTotal = fila.querySelector('.celda-total-asistencia');
    const celdaPorcentaje = fila.querySelector('.celda-porcentaje-asistencia');
    celdaTotal.textContent = totales.total;
    celdaPorcentaje.textContent = `${totales.porcentaje}%`;
}

async function guardarAsistencia() {
    if (asistenciaState.asistencias.length === 0) {
        alert('No hay datos de asistencia para guardar.');
        return;
    }
    asistenciaElementos.btnGuardar.disabled = true;
    asistenciaElementos.btnGuardar.textContent = '⏳ Guardando...';
    try {
        const response = await fetch(`${CONFIG.GOOGLE_SCRIPT_URL}?action=guardarAsistencias`, {
            method: 'POST',
            body: JSON.stringify({
                moduloId: asistenciaState.moduloSeleccionado,
                curso: asistenciaState.cursoSeleccionado,
                mes: asistenciaState.mesSeleccionado,
                asistencias: asistenciaState.asistencias,
                diasDelMes: asistenciaState.diasDelMes
            })
        });
        const data = await response.json();
        if (data.success) {
            alert('✅ Asistencia guardada exitosamente');
        } else {
            alert('❌ Error al guardar: ' + (data.error || 'Error desconocido'));
        }
    } catch (error) {
        console.error('Error al guardar asistencia:', error);
        alert('❌ Error de conexión al guardar la asistencia');
    } finally {
        asistenciaElementos.btnGuardar.disabled = false;
        asistenciaElementos.btnGuardar.textContent = '💾 Guardar';
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarEventosAsistencia);
} else {
    inicializarEventosAsistencia();
}

// ==========================================
// MENÚ LATERAL
// ==========================================

const menuElementos = {
    btnAbrir: document.getElementById('btnAbrirMenu'),
    btnCerrar: document.getElementById('btnCerrarMenu'),
    overlay: document.getElementById('menuOverlay'),
    panel: document.getElementById('menuLateral'),
    btnModoMenu: document.getElementById('btnModoOscuroMenu'),
    textoModo: document.getElementById('textoModo'),
    menuCalif: document.getElementById('menuRegistroCalif'),
    menuAct: document.getElementById('menuRegistroAct'),
    menuAsist: document.getElementById('menuRegistroAsist')
};

function inicializarMenu() {
    // Abrir menú
    menuElementos.btnAbrir.addEventListener('click', abrirMenu);
    
    // Cerrar menú
    menuElementos.btnCerrar.addEventListener('click', cerrarMenu);
    menuElementos.overlay.addEventListener('click', cerrarMenu);
    
    // Modo oscuro desde el menú
    menuElementos.btnModoMenu.addEventListener('click', () => {
        toggleModoOscuro();
        actualizarTextoModo();
    });
    
    // Navegación
    menuElementos.menuCalif.addEventListener('click', () => {
        irARegistroCalificaciones();
        cerrarMenu();
    });
    
    menuElementos.menuAct.addEventListener('click', () => {
        irARegistroActividades();
        cerrarMenu();
    });
    
    menuElementos.menuAsist.addEventListener('click', () => {
        irARegistroAsistencia();
        cerrarMenu();
    });
    
    // Actualizar texto modo al cargar
    actualizarTextoModo();
    
    // Cerrar con ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && menuElementos.panel.classList.contains('active')) {
            cerrarMenu();
        }
    });
}

function abrirMenu() {
    menuElementos.panel.classList.add('active');
    menuElementos.overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    actualizarMenuActivo();
}

function cerrarMenu() {
    menuElementos.panel.classList.remove('active');
    menuElementos.overlay.classList.remove('active');
    document.body.style.overflow = '';
}

function actualizarTextoModo() {
    const esModoOscuro = document.body.classList.contains('dark-mode');
    menuElementos.textoModo.textContent = esModoOscuro ? 'Oscuro' : 'Claro';
}

function actualizarMenuActivo() {
    // Remover active de todos
    [menuElementos.menuCalif, menuElementos.menuAct, menuElementos.menuAsist].forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Agregar active según vista activa
    if (elementos.vistaRegistro.style.display !== 'none') {
        menuElementos.menuCalif.classList.add('active');
    } else if (elementos.vistaActividades.style.display !== 'none') {
        menuElementos.menuAct.classList.add('active');
    } else if (asistenciaElementos.vistaAsistencia.style.display !== 'none') {
        menuElementos.menuAsist.classList.add('active');
    }
}

function irARegistroCalificaciones() {
    elementos.vistaRegistro.style.display = 'block';
    elementos.vistaActividades.style.display = 'none';
    asistenciaElementos.vistaAsistencia.style.display = 'none';
    elementos.selectRA.value = '';
}

function irARegistroActividades() {
    elementos.vistaRegistro.style.display = 'none';
    elementos.vistaActividades.style.display = 'block';
    asistenciaElementos.vistaAsistencia.style.display = 'none';
    
    // Si no hay RA seleccionado, inicializar filtros independientes
    if (!state.raSeleccionado) {
        inicializarFiltrosActividades();
    }
}

function irARegistroAsistencia() {
    mostrarVistaAsistencia();
}

// Inicializar menú al cargar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarMenu);
} else {
    inicializarMenu();
}

// ==========================================
// FILTROS INDEPENDIENTES EN VISTA ACTIVIDADES
// ==========================================

const filtrosActividadesElementos = {
    selectCurso: document.getElementById('selectCursoActividades'),
    selectModulo: document.getElementById('selectModuloActividades'),
    selectRA: document.getElementById('selectRAActividades')
};

// Variable para controlar si los eventos ya fueron inicializados
let eventosFiltrosActividadesInicializados = false;

function inicializarFiltrosActividades() {
    // Limpiar selecciones
    filtrosActividadesElementos.selectCurso.value = '';
    filtrosActividadesElementos.selectModulo.value = '';
    filtrosActividadesElementos.selectRA.value = '';
    
    // Limpiar tabla
    elementos.tablaActividadesHead.innerHTML = '';
    elementos.tablaActividadesBody.innerHTML = '';
    document.getElementById('raDescripcion').value = '';
    
    // Poblar módulos
    poblarModulosActividades();
    
    // Agregar eventos solo una vez
    if (!eventosFiltrosActividadesInicializados) {
        filtrosActividadesElementos.selectCurso.addEventListener('change', manejarCambioCursoActividades);
        filtrosActividadesElementos.selectModulo.addEventListener('change', manejarCambioModuloActividades);
        filtrosActividadesElementos.selectRA.addEventListener('change', manejarCambioRAActividades);
        eventosFiltrosActividadesInicializados = true;
    }
}

function poblarModulosActividades() {
    filtrosActividadesElementos.selectModulo.innerHTML = '<option value="">Seleccione módulo</option>';
    state.modulos.forEach(modulo => {
        const option = document.createElement('option');
        option.value = modulo.id;
        option.textContent = modulo.nombre;
        filtrosActividadesElementos.selectModulo.appendChild(option);
    });
}

async function manejarCambioCursoActividades(e) {
    const curso = e.target.value;
    if (!curso) {
        filtrosActividadesElementos.selectModulo.value = '';
        filtrosActividadesElementos.selectRA.value = '';
        return;
    }
    
    state.cursoSeleccionado = curso;
    
    // Filtrar módulos por curso
    await cargarModulos();
    const modulosFiltrados = state.modulos.filter(m => m.curso === curso);
    
    filtrosActividadesElementos.selectModulo.innerHTML = '<option value="">Seleccione módulo</option>';
    modulosFiltrados.forEach(modulo => {
        const option = document.createElement('option');
        option.value = modulo.id;
        option.textContent = modulo.nombre;
        filtrosActividadesElementos.selectModulo.appendChild(option);
    });
    
    filtrosActividadesElementos.selectRA.innerHTML = '<option value="">Seleccione RA</option>';
}

async function manejarCambioModuloActividades(e) {
    const moduloId = e.target.value;
    if (!moduloId) {
        filtrosActividadesElementos.selectRA.value = '';
        filtrosActividadesElementos.selectRA.innerHTML = '<option value="">Seleccione RA</option>';
        // Limpiar tabla
        elementos.tablaActividadesHead.innerHTML = '';
        elementos.tablaActividadesBody.innerHTML = '';
        return;
    }
    
    state.moduloSeleccionado = moduloId;
    
    // Cargar RAs del módulo
    await cargarRAsDelModulo(moduloId);
    
    // Poblar select de RAs
    filtrosActividadesElementos.selectRA.innerHTML = '<option value="">Seleccione RA</option>';
    state.ras.forEach(ra => {
        const option = document.createElement('option');
        option.value = ra.id;
        option.textContent = `Actividades ${ra.nombre}`;
        filtrosActividadesElementos.selectRA.appendChild(option);
    });
    
    // Limpiar tabla hasta que se seleccione un RA
    elementos.tablaActividadesHead.innerHTML = '';
    elementos.tablaActividadesBody.innerHTML = '';
    document.getElementById('raDescripcion').value = '';
}

async function manejarCambioRAActividades(e) {
    const raId = e.target.value;
    if (!raId) {
        // Limpiar tabla
        elementos.tablaActividadesHead.innerHTML = '';
        elementos.tablaActividadesBody.innerHTML = '';
        document.getElementById('raDescripcion').value = '';
        return;
    }
    
    state.raSeleccionado = raId;
    
    // Cargar estudiantes si no están cargados o si cambió el curso
    if (state.estudiantes.length === 0 && state.cursoSeleccionado) {
        await cargarEstudiantes(state.cursoSeleccionado);
    }
    
    // IMPORTANTE: Recargar y mostrar actividades
    await cargarActividadesRA(raId);
    mostrarVistaActividades();
}

// ==========================================
// SINCRONIZACIÓN DE FILTROS ENTRE MÓDULOS
// ==========================================

function sincronizarFiltrosCalificacionesActividades() {
    // Sincronizar cuando cambien los filtros en Calificaciones
    elementos.selectCurso.addEventListener('change', function() {
        filtrosActividadesElementos.selectCurso.value = this.value;
        // Actualizar módulos en Actividades si hay curso seleccionado
        if (this.value) {
            actualizarModulosEnActividades(this.value);
        }
    });
    
    elementos.selectModulo.addEventListener('change', function() {
        filtrosActividadesElementos.selectModulo.value = this.value;
        // Actualizar RAs en Actividades si hay módulo seleccionado
        if (this.value) {
            actualizarRAsEnActividades(this.value);
        }
    });
    
    elementos.selectRA.addEventListener('change', function() {
        filtrosActividadesElementos.selectRA.value = this.value;
    });
}

async function actualizarModulosEnActividades(curso) {
    // Cargar módulos si es necesario
    if (state.modulos.length === 0) {
        await cargarModulos();
    }
    
    // Filtrar módulos por curso
    const modulosFiltrados = state.modulos.filter(m => m.curso === curso);
    
    // Poblar select de módulos en Actividades
    filtrosActividadesElementos.selectModulo.innerHTML = '<option value="">Seleccione módulo</option>';
    modulosFiltrados.forEach(modulo => {
        const option = document.createElement('option');
        option.value = modulo.id;
        option.textContent = modulo.nombre;
        filtrosActividadesElementos.selectModulo.appendChild(option);
    });
    
    // Si hay módulo seleccionado en Calificaciones, seleccionarlo también
    if (state.moduloSeleccionado) {
        filtrosActividadesElementos.selectModulo.value = state.moduloSeleccionado;
    }
}

async function actualizarRAsEnActividades(moduloId) {
    // Cargar RAs del módulo
    await cargarRAsDelModulo(moduloId);
    
    // Poblar select de RAs en Actividades
    filtrosActividadesElementos.selectRA.innerHTML = '<option value="">Seleccione RA</option>';
    state.ras.forEach(ra => {
        const option = document.createElement('option');
        option.value = ra.id;
        option.textContent = `Actividades ${ra.nombre}`;
        filtrosActividadesElementos.selectRA.appendChild(option);
    });
    
    // Si hay RA seleccionado en Calificaciones, seleccionarlo también
    if (state.raSeleccionado) {
        filtrosActividadesElementos.selectRA.value = state.raSeleccionado;
    }
}

// Inicializar sincronización y eventos al cargar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        inicializarFiltrosActividades();  // Esto inicializa los eventos
        sincronizarFiltrosCalificacionesActividades();
    });
} else {
    inicializarFiltrosActividades();  // Esto inicializa los eventos
    sincronizarFiltrosCalificacionesActividades();
}

// ==========================================
// DESCRIPCIONES DE ACTIVIDADES
// ==========================================

// Variable para almacenar las descripciones
let descripcionesActividades = {};

// Cargar descripciones de actividades
async function cargarDescripcionesActividades(moduloId, raId) {
    console.log('🔍 Cargando descripciones para Módulo:', moduloId, 'RA:', raId);
    try {
        const response = await fetchConTimeout(`${CONFIG.GOOGLE_SCRIPT_URL}?action=getDescripcionesActividades&moduloId=${moduloId}&raId=${raId}`);
        const data = await response.json();
        
        console.log('📥 Respuesta de descripciones:', data);
        
        if (data.success) {
            descripcionesActividades = data.descripciones || {};
            console.log('✅ Descripciones cargadas:', descripcionesActividades);
        } else {
            console.log('❌ Error en respuesta:', data.error);
        }
    } catch (error) {
        console.error('❌ Error al cargar descripciones:', error);
        descripcionesActividades = {};
    }
}

// Posicionar tooltips dinámicamente
function inicializarTooltips() {
    document.addEventListener('mouseover', function(e) {
        if (e.target.closest('.header-actividad')) {
            const header = e.target.closest('.header-actividad');
            const tooltip = header.querySelector('.tooltip-bubble');
            
            if (tooltip) {
                const rect = header.getBoundingClientRect();
                tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
                tooltip.style.top = (rect.top - tooltip.offsetHeight - 15) + 'px';
            }
        }
    });
}

// Inicializar tooltips al cargar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarTooltips);
} else {
    inicializarTooltips();
}

// ==========================================
// ACTUALIZAR DESCRIPCIÓN DEL RA
// ==========================================

// Función para guardar la descripción del RA
async function guardarDescripcionRA() {
    if (!state.raSeleccionado) {
        console.log('No hay RA seleccionado');
        return;
    }
    
    const descripcion = elementos.raDescripcion.value.trim();
    
    try {
        const response = await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'actualizarRA',
                raId: state.raSeleccionado,
                descripcion: descripcion
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ Descripción del RA guardada');
            // Actualizar en el state local
            const raActual = state.ras.find(ra => ra.id == state.raSeleccionado);
            if (raActual) {
                raActual.descripcion = descripcion;
            }
        } else {
            console.error('Error al guardar descripción:', data.error);
        }
    } catch (error) {
        console.error('Error al guardar descripción del RA:', error);
    }
}

// Agregar evento al textarea de descripción para guardar automáticamente
function inicializarEventoDescripcionRA() {
    const raDescripcionTextarea = document.getElementById('raDescripcion');
    
    if (raDescripcionTextarea) {
        // Guardar cuando se sale del campo (blur)
        raDescripcionTextarea.addEventListener('blur', function() {
            if (state.raSeleccionado) {
                guardarDescripcionRA();
            }
        });
        
        // También guardar con Ctrl+S o Cmd+S
        raDescripcionTextarea.addEventListener('keydown', function(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                guardarDescripcionRA();
            }
        });
    }
}

// Inicializar evento al cargar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarEventoDescripcionRA);
} else {
    inicializarEventoDescripcionRA();
}

// ==========================================
// RESUMEN DE DÍAS TRABAJADOS
// ==========================================

function actualizarResumenDiasTrabajados() {
    // Contar días que tienen al menos una asistencia registrada (P, E, A)
    // NO contamos los días marcados como F (feriado)
    
    const inputsAsistencia = document.querySelectorAll('.input-asistencia');
    const diasConAsistencia = new Set();
    
    inputsAsistencia.forEach(input => {
        const estado = input.value.toUpperCase();
        // Solo contamos días con P, E, o A (no F ni vacío)
        if (estado === 'P' || estado === 'E' || estado === 'A') {
            const dia = input.dataset.dia;
            diasConAsistencia.add(dia);
        }
    });
    
    const diasTrabajados = diasConAsistencia.size;
    
    // Actualizar el HTML
    document.getElementById('diasTrabajados').textContent = diasTrabajados;
    
    console.log(`📊 Días trabajados: ${diasTrabajados} (contando solo días con P/E/A)`);
}
