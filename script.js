// Configuración
const CONFIG = {
    GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbw3CURWoHl3tsZd8wflU0z4C_lvU1V55RcUldl2kIzQqIc3l1JsUOlR8R8qxWvsDOtl/exec',
    NUM_ACTIVIDADES: 15,
    PORCENTAJE_APROBATORIO: 70
};

// ==========================================
// SISTEMA DE CACHÉ PERSISTENTE CON LOCALSTORAGE
// ==========================================

const CachePersistente = {
    DURACION: 30 * 60 * 1000, // 30 minutos
    
    guardar(clave, datos) {
        try {
            const item = {
                datos: datos,
                timestamp: Date.now()
            };
            localStorage.setItem(`scjp_cache_${clave}`, JSON.stringify(item));
            console.log(`💾 Cache guardado: ${clave}`);
        } catch (error) {
            console.warn('Error al guardar en localStorage:', error);
        }
    },
    
    obtener(clave) {
        try {
            const item = localStorage.getItem(`scjp_cache_${clave}`);
            if (!item) return null;
            
            const parsed = JSON.parse(item);
            const ahora = Date.now();
            
            if (ahora - parsed.timestamp > this.DURACION) {
                console.log(`⏰ Cache expirado: ${clave}`);
                localStorage.removeItem(`scjp_cache_${clave}`);
                return null;
            }
            
            console.log(`⚡ Cache recuperado: ${clave}`);
            return parsed.datos;
        } catch (error) {
            console.warn('Error al leer localStorage:', error);
            return null;
        }
    },
    
    invalidar(clave) {
        localStorage.removeItem(`scjp_cache_${clave}`);
        console.log(`🗑️ Cache invalidado: ${clave}`);
    },
    
    limpiarTodo() {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith('scjp_cache_')) {
                localStorage.removeItem(key);
            }
        });
        console.log('🧹 Todo el cache limpiado');
    }
};

// ==========================================
// COLA DE PETICIONES OPTIMIZADA
// ==========================================

const ColaPeticiones = {
    cola: [],
    enProceso: 0,
    MAX_SIMULTANEAS: 6,
    
    async agregar(promesaFn) {
        if (this.enProceso < this.MAX_SIMULTANEAS) {
            return await this.ejecutar(promesaFn);
        }
        
        return new Promise((resolve, reject) => {
            this.cola.push({ promesaFn, resolve, reject });
        });
    },
    
    async ejecutar(promesaFn) {
        this.enProceso++;
        try {
            const resultado = await promesaFn();
            this.procesarSiguiente();
            return resultado;
        } catch (error) {
            this.procesarSiguiente();
            throw error;
        }
    },
    
    procesarSiguiente() {
        this.enProceso--;
        if (this.cola.length > 0 && this.enProceso < this.MAX_SIMULTANEAS) {
            const { promesaFn, resolve, reject } = this.cola.shift();
            this.ejecutar(promesaFn).then(resolve).catch(reject);
        }
    }
};

// ==========================================
// PRECARGA INTELIGENTE DE DATOS
// ==========================================

const Precargador = {
    async precargarCurso(curso) {
        if (!curso) return;
        console.log(`🔮 Precargando datos del curso ${curso}...`);
        
        if (!CachePersistente.obtener(`estudiantes_${curso}`)) {
            ColaPeticiones.agregar(async () => {
                try {
                    const response = await fetchConTimeout(`${CONFIG.GOOGLE_SCRIPT_URL}?action=getEstudiantes&curso=${curso}`);
                    const data = await response.json();
                    CachePersistente.guardar(`estudiantes_${curso}`, data.estudiantes);
                    console.log(`✅ Estudiantes de ${curso} precargados`);
                } catch (error) {
                    console.error('Error precargando estudiantes:', error);
                }
            });
        }
    },
    
    async precargarModulo(moduloId) {
        if (!moduloId) return;
        console.log(`🔮 Precargando RAs del módulo ${moduloId}...`);
        
        if (!CachePersistente.obtener(`ras_${moduloId}`)) {
            ColaPeticiones.agregar(async () => {
                try {
                    const response = await fetchConTimeout(`${CONFIG.GOOGLE_SCRIPT_URL}?action=getRAs&moduloId=${moduloId}`);
                    const data = await response.json();
                    CachePersistente.guardar(`ras_${moduloId}`, data.ras);
                    console.log(`✅ RAs del módulo ${moduloId} precargados`);
                } catch (error) {
                    console.error('Error precargando RAs:', error);
                }
            });
        }
    },
    
    async precargarRA(raId) {
        if (!raId) return;
        console.log(`🔮 Precargando actividades del RA ${raId}...`);
        
        if (!CachePersistente.obtener(`actividades_${raId}`)) {
            ColaPeticiones.agregar(async () => {
                try {
                    const response = await fetchConTimeout(`${CONFIG.GOOGLE_SCRIPT_URL}?action=getActividades&raId=${raId}`);
                    const data = await response.json();
                    CachePersistente.guardar(`actividades_${raId}`, data.actividades);
                    console.log(`✅ Actividades del RA ${raId} precargadas`);
                } catch (error) {
                    console.error('Error precargando actividades:', error);
                }
            });
        }
    }
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
    // Intentar caché persistente primero
    const cachePersistente = CachePersistente.obtener('modulos');
    if (cachePersistente) {
        state.modulos = cachePersistente;
        poblarSelectModulos();
        console.log('⚡ Módulos cargados desde localStorage');
        return;
    }
    
    // Luego caché en memoria
    const cached = obtenerDeCache('modulos');
    if (cached) {
        state.modulos = cached;
        poblarSelectModulos();
        return;
    }
    
    mostrarCargando(true, 'Cargando módulos...');
    try {
        const response = await ColaPeticiones.agregar(() => 
            fetchConTimeout(`${CONFIG.GOOGLE_SCRIPT_URL}?action=getModulos`)
        );
        const data = await response.json();
        state.modulos = data.modulos || [];
        
        // Guardar en ambos cachés
        guardarEnCache('modulos', state.modulos);
        CachePersistente.guardar('modulos', state.modulos);
        
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
    // Caché persistente primero
    const cachePersist = CachePersistente.obtener(`estudiantes_${curso}`);
    if (cachePersist) {
        state.estudiantes = cachePersist;
        console.log(`⚡ Estudiantes de ${curso} desde localStorage`);
        return;
    }
    
    // Caché en memoria
    const cached = obtenerDeCache('estudiantes', curso);
    if (cached) {
        state.estudiantes = cached;
        return;
    }
    
    mostrarCargando(true, `Cargando estudiantes de ${curso}...`);
    try {
        const response = await ColaPeticiones.agregar(() =>
            fetchConTimeout(`${CONFIG.GOOGLE_SCRIPT_URL}?action=getEstudiantes&curso=${curso}`)
        );
        const data = await response.json();
        state.estudiantes = data.estudiantes || [];
        
        // Guardar en ambos cachés
        guardarEnCache('estudiantes', state.estudiantes, curso);
        CachePersistente.guardar(`estudiantes_${curso}`, state.estudiantes);
    } catch (error) {
        console.error(`❌ ERROR al cargar estudiantes de ${curso}:`, error);
        state.estudiantes = [];
    } finally {
        mostrarCargando(false);
    }
}

async function cargarRAsDelModulo(moduloId) {
    // Caché persistente
    const cachePersist = CachePersistente.obtener(`ras_${moduloId}`);
    if (cachePersist) {
        state.ras = cachePersist;
        poblarSelectRAs();
        console.log(`⚡ RAs del módulo ${moduloId} desde localStorage`);
        return;
    }
    
    // Caché en memoria
    const cached = obtenerDeCache('ras', moduloId);
    if (cached) {
        state.ras = cached;
        poblarSelectRAs();
        return;
    }
    
    mostrarCargando(true, 'Cargando resultados de aprendizaje...');
    try {
        const response = await ColaPeticiones.agregar(() =>
            fetchConTimeout(`${CONFIG.GOOGLE_SCRIPT_URL}?action=getRAs&moduloId=${moduloId}`)
        );
        const data = await response.json();
        state.ras = data.ras || [];
        
        // Guardar en ambos cachés
        guardarEnCache('ras', state.ras, moduloId);
        CachePersistente.guardar(`ras_${moduloId}`, state.ras);
        
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
    // Caché persistente
    const cachePersist = CachePersistente.obtener(`actividades_${raId}`);
    if (cachePersist) {
        state.actividades = state.actividades.filter(a => a.raId != raId);
        state.actividades.push(...cachePersist);
        await cargarDescripcionesActividades(state.moduloSeleccionado, raId);
        generarTablaActividades();
        cargarInstrumentosRA(state.moduloSeleccionado, raId).then(() => {
            generarTablaActividades();
        });
        console.log(`⚡ Actividades del RA ${raId} desde localStorage`);
        return;
    }
    
    // Caché en memoria
    const cached = obtenerDeCache('actividades', raId);
    if (cached) {
        state.actividades = state.actividades.filter(a => a.raId != raId);
        state.actividades.push(...cached);
        await cargarDescripcionesActividades(state.moduloSeleccionado, raId);
        generarTablaActividades();
        cargarInstrumentosRA(state.moduloSeleccionado, raId).then(() => {
            generarTablaActividades();
        });
        return;
    }
    
    mostrarCargando(true, 'Cargando actividades del RA...');
    try {
        const response = await ColaPeticiones.agregar(() =>
            fetchConTimeout(`${CONFIG.GOOGLE_SCRIPT_URL}?action=getActividades&raId=${raId}`)
        );
        const data = await response.json();
        const actividadesDelRA = data.actividades || [];
        
        // Guardar en ambos cachés
        guardarEnCache('actividades', actividadesDelRA, raId);
        CachePersistente.guardar(`actividades_${raId}`, actividadesDelRA);
        
        state.actividades = state.actividades.filter(a => a.raId != raId);
        state.actividades.push(...actividadesDelRA);
        await cargarDescripcionesActividades(state.moduloSeleccionado, raId);
        generarTablaActividades();
        cargarInstrumentosRA(state.moduloSeleccionado, raId).then(() => {
            generarTablaActividades();
        });
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
        
        // Precargar datos anticipadamente
        Precargador.precargarCurso(curso);
        
        poblarSelectModulos();
        if (state.moduloSeleccionado) {
            await cargarCalificaciones(state.moduloSeleccionado);
        }
    } else {
        state.cursoSeleccionado = null;
        state.estudiantes = [];
        poblarSelectModulos();
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
        
        // Precargar RAs anticipadamente
        Precargador.precargarModulo(moduloId);
        
        try {
            // Cargar RAs y Calificaciones en paralelo
            await Promise.all([
                cargarRAsDelModulo(moduloId),
                cargarCalificaciones(moduloId)
            ]);
        } catch (error) {
            console.error('Error al cargar módulo:', error);
        } finally {
            mostrarCargando(false);
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
    console.log('📋 Instrumentos en caché:', instrumentosCache.configuraciones);
    console.log('📝 Descripciones disponibles:', descripcionesActividades);
    
    // Generar encabezado
    let headerHTML = '<tr>';
    headerHTML += '<th class="header-numero">No.</th>';
    headerHTML += '<th class="header-nombre">Nombres</th>';
    
    for (let i = 1; i <= CONFIG.NUM_ACTIVIDADES; i++) {
        const descripcion = descripcionesActividades[i] || '';
        console.log(`  Ac.${i}: ${descripcion ? '✅ Tiene descripción' : '❌ Sin descripción'}`);
        if (descripcion) {
            headerHTML += `
                <th class="actividad-header header-actividad" data-num-actividad="${i}">
                    Ac.${i}
                    <span class="info-icon config-icon" onclick="abrirModalConfigInstrumento(${state.moduloSeleccionado}, ${state.raSeleccionado}, ${i})">ℹ</span>
                    <div class="tooltip-bubble">${descripcion}</div>
                </th>`;
        } else {
            headerHTML += `
                <th class="actividad-header" data-num-actividad="${i}">
                    Ac.${i}
                    <span class="info-icon config-icon" onclick="abrirModalConfigInstrumento(${state.moduloSeleccionado}, ${state.raSeleccionado}, ${i})">ℹ</span>
                </th>`;
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
            const tieneInstrumento = tieneInstrumentoConfigurado(state.moduloSeleccionado, state.raSeleccionado, i);
            
            // Debug detallado
            if (i <= 3) { // Solo para las primeras 3 actividades para no saturar
                console.log(`  🔍 Ac.${i} - tiene instrumento:`, tieneInstrumento);
            }
            
            const claseExtra = tieneInstrumento ? ' celda-con-instrumento' : '';
            const iconoInstrumento = tieneInstrumento ? '<span class="icono-instrumento" title="Click para evaluar con instrumento">📋</span>' : '';
            
            bodyHTML += `<td class="celda-actividad-eval${claseExtra}" 
                            data-estudiante="${estudiante.id}" 
                            data-actividad="${i}" 
                            data-ra="${state.raSeleccionado}"
                            data-modulo="${state.moduloSeleccionado}">
                            ${iconoInstrumento}
                            <input type="number" 
                                   class="input-actividad${tieneInstrumento ? ' input-con-instrumento' : ''}" 
                                   data-estudiante="${estudiante.id}" 
                                   data-actividad="${i}" 
                                   data-ra="${state.raSeleccionado}" 
                                   value="${valor !== null && valor !== undefined ? valor : ''}" 
                                   min="0" 
                                   max="10"
                                   ${tieneInstrumento ? 'readonly title="Click para evaluar con instrumento"' : ''}>
                         </td>`;
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
        
        // Invalidar caché de actividades y calificaciones (memoria y localStorage)
        invalidarCache('actividades', state.raSeleccionado);
        invalidarCache('calificaciones', state.moduloSeleccionado);
        CachePersistente.invalidar(`actividades_${state.raSeleccionado}`);
        CachePersistente.invalidar(`calificaciones_${state.moduloSeleccionado}`);
        
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
    
    // Procesar si es input de asistencia
    if (target.matches('.input-asistencia')) {
        e.preventDefault();
        const pastedData = (e.clipboardData || window.clipboardData).getData('text');
        if (!pastedData) return;

        const rows = pastedData.split(/\r?\n/).filter(row => row.trim());
        const parsedRows = rows.map(row => row.split('\t'));

        const currentCell = target.closest('td');
        if (!currentCell) return;
        const currentRow = currentCell.closest('tr');
        const tbody = currentRow.parentElement;
        const allRows = Array.from(tbody.querySelectorAll('tr'));
        const currentRowIndex = allRows.indexOf(currentRow);
        const allCellsInRow = Array.from(currentRow.querySelectorAll('td'));
        const currentCellIndex = allCellsInRow.indexOf(currentCell);

        console.log(`📋 Pegando asistencia: ${parsedRows.length} filas × ${parsedRows[0].length} columnas`);

        parsedRows.forEach((rowData, rowOffset) => {
            const targetRowIndex = currentRowIndex + rowOffset;
            if (targetRowIndex >= allRows.length) return;

            const targetRow = allRows[targetRowIndex];
            const cellsInTargetRow = Array.from(targetRow.querySelectorAll('td'));

            rowData.forEach((cellValue, colOffset) => {
                const targetCellIndex = currentCellIndex + colOffset;
                if (targetCellIndex >= cellsInTargetRow.length) return;

                const targetCell = cellsInTargetRow[targetCellIndex];
                const input = targetCell.querySelector('.input-asistencia');

                if (input) {
                    const valor = cellValue.trim().toUpperCase();
                    if (['P', 'E', 'A', 'F', ''].includes(valor)) {
                        input.value = valor;
                        input.className = 'input-asistencia ' + obtenerClaseEstado(valor);
                        const estudianteId = input.dataset.estudiante;
                        const dia = parseInt(input.dataset.dia);
                        actualizarAsistenciaState(estudianteId, dia, valor);
                        actualizarTotalesEstudiante(estudianteId);
                    }
                }
            });
        });

        actualizarResumenDiasTrabajados();
        console.log('✅ Asistencia pegada correctamente');
        return;
    }

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

    // Días trabajados = días con P, E o A (excluyendo feriados y vacíos)
    // Se calculan globalmente: días donde AL MENOS un estudiante tiene registro P/E/A
    const diasTrabajados = calcularDiasTrabajadosGlobal();

    const excusasComoAusencias = Math.floor(excusas / 3);
    const total = presentes + (excusas - (excusasComoAusencias * 3));
    // El 100% se basa en los días trabajados (no en el total de columnas)
    const porcentaje = diasTrabajados > 0 ? Math.round((total / diasTrabajados) * 100) : 0;
    return {total, porcentaje};
}

function calcularDiasTrabajadosGlobal() {
    // Cuenta los días que tienen al menos un registro P, E o A de cualquier estudiante
    const diasConActividad = new Set();
    asistenciaState.asistencias.forEach(a => {
        const estado = (a.estado || '').toUpperCase();
        if (estado === 'P' || estado === 'E' || estado === 'A') {
            diasConActividad.add(Number(a.dia));
        }
    });
    return diasConActividad.size;
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

// ==========================================
// SISTEMA DE INSTRUMENTOS DE EVALUACIÓN
// ==========================================

// ==========================================
// MODAL DE CONFIGURACIÓN DE INSTRUMENTO
// ==========================================

const modalConfigState = {
    moduloId: null,
    raId: null,
    numActividad: null,
    criteriosCounter: 0
};

const modalConfigElementos = {
    modal: document.getElementById('modalConfigInstrumento'),
    overlay: document.querySelector('.modal-overlay-instrumento'),
    btnCerrar: document.getElementById('btnCerrarConfigInstrumento'),
    btnCancelar: document.getElementById('btnCancelarConfigInstrumento'),
    btnGuardar: document.getElementById('btnGuardarConfigInstrumento'),
    moduloNombre: document.getElementById('configModuloNombre'),
    raNombre: document.getElementById('configRANombre'),
    actividadNum: document.getElementById('configActividadNum'),
    valorActividad: document.getElementById('configValorActividad'),
    criteriosSection: document.getElementById('configCriteriosSection'),
    criteriosLista: document.getElementById('configCriteriosLista'),
    totalPuntos: document.getElementById('totalPuntosCriterios'),
    btnAgregarCriterio: document.getElementById('btnAgregarCriterio')
};

// Abrir modal de configuración
async function abrirModalConfigInstrumento(moduloId, raId, numActividad) {
    console.log(`⚙️ Abriendo configuración de instrumento: Módulo ${moduloId}, RA ${raId}, Ac.${numActividad}`);
    
    modalConfigState.moduloId = moduloId;
    modalConfigState.raId = raId;
    modalConfigState.numActividad = numActividad;
    modalConfigState.criteriosCounter = 0;
    
    // Obtener nombres para mostrar
    const modulo = state.modulos.find(m => m.id == moduloId);
    const ra = state.ras.find(r => r.id == raId);
    
    modalConfigElementos.moduloNombre.textContent = modulo ? modulo.nombre : '-';
    modalConfigElementos.raNombre.textContent = ra ? ra.nombre : '-';
    modalConfigElementos.actividadNum.textContent = `Ac.${numActividad}`;
    
    // Limpiar formulario
    modalConfigElementos.valorActividad.value = '';
    modalConfigElementos.criteriosLista.innerHTML = '';
    document.getElementById('radioSinInstrumento').checked = true;
    modalConfigElementos.criteriosSection.style.display = 'none';
    
    // ABRIR MODAL INMEDIATAMENTE ⚡
    modalConfigElementos.modal.style.display = 'flex';
    
    // Cargar configuración existente en segundo plano
    try {
        const url = `${CONFIG.GOOGLE_SCRIPT_URL}?action=getInstrumentoActividad&moduloId=${moduloId}&raId=${raId}&numActividad=${numActividad}`;
        const response = await fetchConTimeout(url);
        const data = await response.json();
        
        if (data.success && data.configurado) {
            modalConfigElementos.valorActividad.value = data.valorActividad;
            document.getElementById(`radio${capitalizeFirst(data.tipoInstrumento)}`).checked = true;
            
            if (data.tipoInstrumento !== 'sin_instrumento') {
                modalConfigElementos.criteriosSection.style.display = 'block';
                await cargarCriteriosExistentes(moduloId, raId, numActividad);
            }
        }
    } catch (error) {
        console.error('Error al cargar configuración:', error);
    }
}

function capitalizeFirst(str) {
    return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
}

// Cargar criterios existentes
async function cargarCriteriosExistentes(moduloId, raId, numActividad) {
    try {
        const url = `${CONFIG.GOOGLE_SCRIPT_URL}?action=getCriteriosActividad&moduloId=${moduloId}&raId=${raId}&numActividad=${numActividad}`;
        const response = await fetchConTimeout(url);
        const data = await response.json();
        
        if (data.success && data.criterios.length > 0) {
            data.criterios.forEach(criterio => {
                agregarCriterioConfig(criterio.criterio, criterio.puntajeMax);
            });
        }
    } catch (error) {
        console.error('Error al cargar criterios:', error);
    }
}

// Cerrar modal
function cerrarModalConfigInstrumento() {
    modalConfigElementos.modal.style.display = 'none';
}

// Cambio de tipo de instrumento
document.querySelectorAll('input[name="tipoInstrumento"]').forEach(radio => {
    radio.addEventListener('change', function() {
        if (this.value === 'sin_instrumento') {
            modalConfigElementos.criteriosSection.style.display = 'none';
        } else {
            modalConfigElementos.criteriosSection.style.display = 'block';
        }
    });
});

// Agregar criterio
function agregarCriterioConfig(nombre = '', puntaje = '') {
    modalConfigState.criteriosCounter++;
    const id = modalConfigState.criteriosCounter;
    
    const div = document.createElement('div');
    div.className = 'criterio-item-config';
    div.setAttribute('data-criterio-id', id);
    div.innerHTML = `
        <div class="criterio-orden">${id}</div>
        <input type="text" class="criterio-input-nombre" placeholder="Nombre del criterio" value="${nombre}" data-id="${id}">
        <input type="number" class="criterio-input-puntaje" placeholder="Puntos" min="0" step="0.1" value="${puntaje}" data-id="${id}">
        <button type="button" class="btn-eliminar-criterio" data-id="${id}">✕</button>
    `;
    
    modalConfigElementos.criteriosLista.appendChild(div);
    
    // Event listeners
    div.querySelector('.criterio-input-puntaje').addEventListener('input', calcularTotalCriterios);
    div.querySelector('.btn-eliminar-criterio').addEventListener('click', function() {
        eliminarCriterioConfig(this.dataset.id);
    });
    
    calcularTotalCriterios();
}

// Eliminar criterio
function eliminarCriterioConfig(id) {
    const criterio = document.querySelector(`[data-criterio-id="${id}"]`);
    if (criterio) {
        criterio.remove();
        renumerarCriterios();
        calcularTotalCriterios();
    }
}

// Renumerar criterios
function renumerarCriterios() {
    const criterios = modalConfigElementos.criteriosLista.querySelectorAll('.criterio-item-config');
    criterios.forEach((criterio, index) => {
        criterio.querySelector('.criterio-orden').textContent = index + 1;
    });
}

// Calcular total de criterios
function calcularTotalCriterios() {
    const inputs = modalConfigElementos.criteriosLista.querySelectorAll('.criterio-input-puntaje');
    let total = 0;
    inputs.forEach(input => {
        const valor = parseFloat(input.value) || 0;
        total += valor;
    });
    modalConfigElementos.totalPuntos.textContent = total.toFixed(1);
}

// Guardar configuración
async function guardarConfigInstrumento() {
    const valor = parseFloat(modalConfigElementos.valorActividad.value);
    const tipoInstrumento = document.querySelector('input[name="tipoInstrumento"]:checked').value;
    
    if (!valor || valor <= 0) {
        alert('⚠️ Por favor ingresa un valor válido para la actividad');
        return;
    }
    
    if (tipoInstrumento !== 'sin_instrumento') {
        const criterios = modalConfigElementos.criteriosLista.querySelectorAll('.criterio-item-config');
        if (criterios.length === 0) {
            alert('⚠️ Debes agregar al menos un criterio');
            return;
        }
        
        // Validar que todos los criterios tengan nombre y puntaje
        let valido = true;
        criterios.forEach(criterio => {
            const nombre = criterio.querySelector('.criterio-input-nombre').value.trim();
            const puntaje = parseFloat(criterio.querySelector('.criterio-input-puntaje').value);
            if (!nombre || !puntaje || puntaje <= 0) {
                valido = false;
            }
        });
        
        if (!valido) {
            alert('⚠️ Todos los criterios deben tener nombre y puntaje válido');
            return;
        }
    }
    
    modalConfigElementos.btnGuardar.disabled = true;
    modalConfigElementos.btnGuardar.textContent = '⏳ Guardando...';
    
    try {
        // Guardar configuración del instrumento
        const dataInstrumento = {
            action: 'guardarInstrumentoActividad',
            moduloId: modalConfigState.moduloId,
            raId: modalConfigState.raId,
            numActividad: modalConfigState.numActividad,
            tipoInstrumento: tipoInstrumento,
            valorActividad: valor
        };
        
        const respInstrumento = await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(dataInstrumento)
        });
        
        const resultInstrumento = await respInstrumento.json();
        
        if (!resultInstrumento.success) {
            throw new Error('Error al guardar configuración del instrumento');
        }
        
        // Guardar criterios si no es sin_instrumento
        if (tipoInstrumento !== 'sin_instrumento') {
            const criteriosArray = [];
            const criterios = modalConfigElementos.criteriosLista.querySelectorAll('.criterio-item-config');
            
            criterios.forEach((criterio, index) => {
                criteriosArray.push({
                    orden: index + 1,
                    criterio: criterio.querySelector('.criterio-input-nombre').value.trim(),
                    puntajeMax: parseFloat(criterio.querySelector('.criterio-input-puntaje').value)
                });
            });
            
            const dataCriterios = {
                action: 'guardarCriteriosActividad',
                moduloId: modalConfigState.moduloId,
                raId: modalConfigState.raId,
                numActividad: modalConfigState.numActividad,
                criterios: criteriosArray
            };
            
            const respCriterios = await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify(dataCriterios)
            });
            
            const resultCriterios = await respCriterios.json();
            
            if (!resultCriterios.success) {
                throw new Error('Error al guardar criterios');
            }
        }
        
        console.log('✅ Configuración guardada exitosamente');
        console.log('📍 Vista actual:', state.vistaActual);
        console.log('📍 Módulo seleccionado:', state.moduloSeleccionado);
        console.log('📍 RA seleccionado:', state.raSeleccionado);
        
        // ACTUALIZAR CACHÉ INMEDIATAMENTE
        const clave = `${modalConfigState.moduloId}_${modalConfigState.raId}_${modalConfigState.numActividad}`;
        
        if (tipoInstrumento === 'sin_instrumento') {
            // Eliminar del caché si se configura "sin instrumento"
            delete instrumentosCache.configuraciones[clave];
            console.log(`🗑️ Instrumento eliminado del caché: ${clave}`);
        } else {
            // Agregar/actualizar en caché
            instrumentosCache.configuraciones[clave] = {
                tipoInstrumento: tipoInstrumento,
                valorActividad: valor
            };
            console.log(`💾 Caché actualizado para ${clave}:`, instrumentosCache.configuraciones[clave]);
            console.log('📦 Estado completo del caché:', Object.keys(instrumentosCache.configuraciones));
        }
        
        // FORZAR regeneración de tabla (sin condición)
        console.log('🔄 FORZANDO regeneración de tabla...');
        generarTablaActividades();
        console.log('✅ Tabla regenerada');
        
        // Verificar que los iconos aparezcan
        setTimeout(() => {
            const iconos = document.querySelectorAll('.icono-instrumento');
            console.log(`📋 Total de iconos en la página: ${iconos.length}`);
            if (iconos.length === 0) {
                console.error('❌ ERROR: No se encontraron iconos después de regenerar');
                console.error('🔍 Verificando caché nuevamente:', instrumentosCache.configuraciones);
            }
        }, 200);
        
        cerrarModalConfigInstrumento();
        
        // Mostrar mensaje elegante
        mostrarMensajeExito('¡Configuración Guardada!', 'El instrumento ha sido configurado exitosamente');
        
    } catch (error) {
        console.error('Error al guardar configuración:', error);
        alert('❌ Error al guardar la configuración. Intenta de nuevo.');
    } finally {
        modalConfigElementos.btnGuardar.disabled = false;
        modalConfigElementos.btnGuardar.textContent = '💾 Guardar Configuración';
    }
}

// Event listeners del modal de configuración
modalConfigElementos.btnCerrar.addEventListener('click', cerrarModalConfigInstrumento);
modalConfigElementos.btnCancelar.addEventListener('click', cerrarModalConfigInstrumento);
modalConfigElementos.overlay.addEventListener('click', cerrarModalConfigInstrumento);
modalConfigElementos.btnGuardar.addEventListener('click', guardarConfigInstrumento);
modalConfigElementos.btnAgregarCriterio.addEventListener('click', () => agregarCriterioConfig());

// ==========================================
// MODAL DE EVALUACIÓN CON INSTRUMENTO
// ==========================================

const modalEvalState = {
    estudianteId: null,
    moduloId: null,
    raId: null,
    numActividad: null,
    tipoInstrumento: null,
    valorActividad: null,
    criterios: [],
    evaluaciones: {}
};

const modalEvalElementos = {
    modal: document.getElementById('modalEvaluacion'),
    overlay: document.querySelector('.modal-overlay-evaluacion'),
    btnCerrar: document.getElementById('btnCerrarEvaluacion'),
    btnCancelar: document.getElementById('btnCancelarEvaluacion'),
    btnGuardar: document.getElementById('btnGuardarEvaluacion'),
    titulo: document.getElementById('tituloEvaluacion'),
    nombreEstudiante: document.getElementById('evalNombreEstudiante'),
    detalleActividad: document.getElementById('evalDetalleActividad'),
    valorActividad: document.getElementById('evalValorActividad'),
    listaCotejo: document.getElementById('listaCriteriosCotejo'),
    listaRubrica: document.getElementById('listaCriteriosRubrica'),
    listaEscala: document.getElementById('listaCriteriosEscala'),
    instrumentoCotejo: document.getElementById('instrumentoListaCotejo'),
    instrumentoRubrica: document.getElementById('instrumentoRubrica'),
    instrumentoEscala: document.getElementById('instrumentoEscala'),
    puntosObtenidos: document.getElementById('evalPuntosObtenidos'),
    puntosMaximos: document.getElementById('evalPuntosMaximos'),
    valorBase: document.getElementById('evalValorBase'),
    notaFinal: document.getElementById('evalNotaFinal')
};

// Abrir modal de evaluación
async function abrirModalEvaluacion(estudianteId, moduloId, raId, numActividad) {
    console.log(`📝 Abriendo evaluación para Estudiante ${estudianteId}, Ac.${numActividad}`);
    
    modalEvalState.estudianteId = estudianteId;
    modalEvalState.moduloId = moduloId;
    modalEvalState.raId = raId;
    modalEvalState.numActividad = numActividad;
    modalEvalState.evaluaciones = {};
    
    const estudiante = state.estudiantes.find(e => e.id == estudianteId);
    const modulo = state.modulos.find(m => m.id == moduloId);
    const ra = state.ras.find(r => r.id == raId);
    
    modalEvalElementos.nombreEstudiante.textContent = estudiante ? estudiante.nombre : '-';
    modalEvalElementos.detalleActividad.textContent = `${modulo ? modulo.nombre : '-'} • ${ra ? ra.nombre : '-'} • Ac.${numActividad}`;
    
    // INTENTAR OBTENER DEL CACHÉ PRIMERO ⚡
    const clave = `${moduloId}_${raId}_${numActividad}`;
    const instrumentoCache = instrumentosCache.configuraciones[clave];
    
    if (instrumentoCache) {
        console.log('⚡ Usando instrumento desde caché');
        modalEvalState.tipoInstrumento = instrumentoCache.tipoInstrumento;
        modalEvalState.valorActividad = instrumentoCache.valorActividad;
        
        modalEvalElementos.valorActividad.textContent = instrumentoCache.valorActividad;
        modalEvalElementos.valorBase.textContent = instrumentoCache.valorActividad;
        
        const titulos = {
            'lista_cotejo': '✓ Lista de Cotejo',
            'rubrica': '⭐ Rúbrica',
            'escala': '📊 Escala de Valoración'
        };
        modalEvalElementos.titulo.textContent = titulos[instrumentoCache.tipoInstrumento] || 'Evaluar Actividad';
        
        // ABRIR MODAL INMEDIATAMENTE ⚡⚡⚡
        ocultarTodosInstrumentos();
        modalEvalElementos.modal.style.display = 'flex';
        
        // Mostrar mensaje de carga
        const loadingHTML = '<div style="text-align: center; padding: 40px;"><div style="font-size: 2rem;">⏳</div><div>Cargando criterios...</div></div>';
        modalEvalElementos.listaCotejo.innerHTML = loadingHTML;
        modalEvalElementos.listaRubrica.innerHTML = loadingHTML;
        modalEvalElementos.listaEscala.innerHTML = loadingHTML;
        
        switch (modalEvalState.tipoInstrumento) {
            case 'lista_cotejo':
                modalEvalElementos.instrumentoCotejo.style.display = 'block';
                break;
            case 'rubrica':
                modalEvalElementos.instrumentoRubrica.style.display = 'block';
                break;
            case 'escala':
                modalEvalElementos.instrumentoEscala.style.display = 'block';
                break;
        }
    }
    
    try {
        // Cargar criterios y evaluaciones EN PARALELO ⚡
        const [dataCriterios, dataEvaluacion] = await Promise.all([
            fetchConTimeout(`${CONFIG.GOOGLE_SCRIPT_URL}?action=getCriteriosActividad&moduloId=${moduloId}&raId=${raId}&numActividad=${numActividad}`).then(r => r.json()),
            fetchConTimeout(`${CONFIG.GOOGLE_SCRIPT_URL}?action=getEvaluacionDetallada&estudianteId=${estudianteId}&moduloId=${moduloId}&raId=${raId}&numActividad=${numActividad}`).then(r => r.json())
        ]);
        
        if (!dataCriterios.success || dataCriterios.criterios.length === 0) {
            alert('⚠️ Esta actividad no tiene criterios configurados');
            modalEvalElementos.modal.style.display = 'none';
            return;
        }
        
        modalEvalState.criterios = dataCriterios.criterios;
        
        const totalPuntos = dataCriterios.criterios.reduce((sum, c) => sum + c.puntajeMax, 0);
        modalEvalElementos.puntosMaximos.textContent = totalPuntos.toFixed(1);
        
        if (dataEvaluacion.success && dataEvaluacion.evaluaciones.length > 0) {
            dataEvaluacion.evaluaciones.forEach(ev => {
                modalEvalState.evaluaciones[ev.orden] = ev.calificacion;
            });
        }
        
        // Si no se abrió desde caché, abrir ahora
        if (!instrumentoCache) {
            // Cargar info del instrumento si no estaba en caché
            const dataInstrumento = await fetchConTimeout(`${CONFIG.GOOGLE_SCRIPT_URL}?action=getInstrumentoActividad&moduloId=${moduloId}&raId=${raId}&numActividad=${numActividad}`).then(r => r.json());
            
            if (!dataInstrumento.success || !dataInstrumento.configurado) {
                alert('⚠️ Esta actividad no tiene instrumento configurado');
                return;
            }
            
            modalEvalState.tipoInstrumento = dataInstrumento.tipoInstrumento;
            modalEvalState.valorActividad = dataInstrumento.valorActividad;
            
            modalEvalElementos.valorActividad.textContent = dataInstrumento.valorActividad;
            modalEvalElementos.valorBase.textContent = dataInstrumento.valorActividad;
            
            const titulos = {
                'lista_cotejo': '✓ Lista de Cotejo',
                'rubrica': '⭐ Rúbrica',
                'escala': '📊 Escala de Valoración'
            };
            modalEvalElementos.titulo.textContent = titulos[dataInstrumento.tipoInstrumento] || 'Evaluar Actividad';
            
            ocultarTodosInstrumentos();
        }
        
        // Generar el instrumento correspondiente
        switch (modalEvalState.tipoInstrumento) {
            case 'lista_cotejo':
                generarListaCotejo();
                modalEvalElementos.instrumentoCotejo.style.display = 'block';
                break;
            case 'rubrica':
                generarRubrica();
                modalEvalElementos.instrumentoRubrica.style.display = 'block';
                break;
            case 'escala':
                generarEscala();
                modalEvalElementos.instrumentoEscala.style.display = 'block';
                break;
        }
        
        calcularNotaFinal();
        
        // Si no se abrió desde caché, abrir ahora
        if (!instrumentoCache) {
            modalEvalElementos.modal.style.display = 'flex';
        }
        
        console.log('✅ Modal de evaluación cargado completamente');
        
    } catch (error) {
        console.error('Error al abrir modal de evaluación:', error);
        alert('❌ Error al cargar la evaluación');
        modalEvalElementos.modal.style.display = 'none';
    }
}

function ocultarTodosInstrumentos() {
    modalEvalElementos.instrumentoCotejo.style.display = 'none';
    modalEvalElementos.instrumentoRubrica.style.display = 'none';
    modalEvalElementos.instrumentoEscala.style.display = 'none';
}

function generarListaCotejo() {
    modalEvalElementos.listaCotejo.innerHTML = '';
    
    modalEvalState.criterios.forEach((criterio) => {
        const checked = modalEvalState.evaluaciones[criterio.orden] === criterio.puntajeMax ? 'checked' : '';
        
        const div = document.createElement('div');
        div.className = 'eval-criterio-item lista-cotejo';
        div.innerHTML = `
            <div class="eval-criterio-header">
                <span class="eval-criterio-nombre">${criterio.criterio}</span>
                <span class="eval-criterio-puntaje">${criterio.puntajeMax} pts</span>
            </div>
            <label class="eval-checkbox-container">
                <input type="checkbox" class="eval-checkbox" data-orden="${criterio.orden}" data-puntaje="${criterio.puntajeMax}" ${checked}>
                <span class="eval-checkbox-label">Criterio cumplido</span>
            </label>
        `;
        
        const checkbox = div.querySelector('.eval-checkbox');
        checkbox.addEventListener('change', function() {
            modalEvalState.evaluaciones[criterio.orden] = this.checked ? criterio.puntajeMax : 0;
            calcularNotaFinal();
        });
        
        if (checked) {
            modalEvalState.evaluaciones[criterio.orden] = criterio.puntajeMax;
        } else if (!(criterio.orden in modalEvalState.evaluaciones)) {
            modalEvalState.evaluaciones[criterio.orden] = 0;
        }
        
        modalEvalElementos.listaCotejo.appendChild(div);
    });
}

function generarRubrica() {
    modalEvalElementos.listaRubrica.innerHTML = '';
    
    modalEvalState.criterios.forEach((criterio) => {
        const evalActual = modalEvalState.evaluaciones[criterio.orden] || 0;
        
        const niveles = [
            { nombre: 'Excelente', valor: criterio.puntajeMax, clase: 'nivel-excelente' },
            { nombre: 'Bueno', valor: criterio.puntajeMax * 0.8, clase: 'nivel-bueno' },
            { nombre: 'Regular', valor: criterio.puntajeMax * 0.5, clase: 'nivel-regular' },
            { nombre: 'Deficiente', valor: 0, clase: 'nivel-deficiente' }
        ];
        
        const div = document.createElement('div');
        div.className = 'eval-criterio-item rubrica';
        div.innerHTML = `
            <div class="eval-criterio-header">
                <span class="eval-criterio-nombre">${criterio.criterio}</span>
                <span class="eval-criterio-puntaje">${criterio.puntajeMax} pts</span>
            </div>
            <div class="eval-niveles-rubrica">
                ${niveles.map(nivel => `
                    <button type="button" class="eval-nivel-btn ${nivel.clase} ${evalActual === nivel.valor ? 'selected' : ''}" 
                            data-orden="${criterio.orden}" 
                            data-valor="${nivel.valor}">
                        <span class="eval-nivel-nombre">${nivel.nombre}</span>
                        <span class="eval-nivel-puntos">(${nivel.valor.toFixed(1)} pts)</span>
                    </button>
                `).join('')}
            </div>
        `;
        
        div.querySelectorAll('.eval-nivel-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const orden = parseInt(this.dataset.orden);
                const valor = parseFloat(this.dataset.valor);
                
                this.closest('.eval-niveles-rubrica').querySelectorAll('.eval-nivel-btn').forEach(b => {
                    b.classList.remove('selected');
                });
                
                this.classList.add('selected');
                modalEvalState.evaluaciones[orden] = valor;
                calcularNotaFinal();
            });
        });
        
        if (!(criterio.orden in modalEvalState.evaluaciones)) {
            modalEvalState.evaluaciones[criterio.orden] = 0;
        }
        
        modalEvalElementos.listaRubrica.appendChild(div);
    });
}

function generarEscala() {
    modalEvalElementos.listaEscala.innerHTML = '';
    
    modalEvalState.criterios.forEach((criterio) => {
        const evalActual = modalEvalState.evaluaciones[criterio.orden];
        let nivelActual = 0;
        
        if (evalActual !== undefined) {
            nivelActual = Math.round((evalActual / criterio.puntajeMax) * 5);
        }
        
        const div = document.createElement('div');
        div.className = 'eval-criterio-item escala';
        div.innerHTML = `
            <div class="eval-criterio-header">
                <span class="eval-criterio-nombre">${criterio.criterio}</span>
                <span class="eval-criterio-puntaje">${criterio.puntajeMax} pts</span>
            </div>
            <div class="eval-escala-container">
                <div class="eval-escala-numeros">
                    ${[1,2,3,4,5].map(n => `
                        <button type="button" class="eval-escala-btn ${nivelActual === n ? 'selected' : ''}" 
                                data-orden="${criterio.orden}" 
                                data-nivel="${n}" 
                                data-puntaje-max="${criterio.puntajeMax}">
                            ${n}
                        </button>
                    `).join('')}
                </div>
                <span class="eval-escala-valor">${nivelActual}/5</span>
            </div>
        `;
        
        div.querySelectorAll('.eval-escala-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const orden = parseInt(this.dataset.orden);
                const nivel = parseInt(this.dataset.nivel);
                const puntajeMax = parseFloat(this.dataset.puntajeMax);
                
                this.closest('.eval-escala-numeros').querySelectorAll('.eval-escala-btn').forEach(b => {
                    b.classList.remove('selected');
                });
                
                this.classList.add('selected');
                this.closest('.eval-escala-container').querySelector('.eval-escala-valor').textContent = `${nivel}/5`;
                
                const puntaje = (nivel / 5) * puntajeMax;
                modalEvalState.evaluaciones[orden] = puntaje;
                calcularNotaFinal();
            });
        });
        
        if (!(criterio.orden in modalEvalState.evaluaciones)) {
            modalEvalState.evaluaciones[criterio.orden] = 0;
        }
        
        modalEvalElementos.listaEscala.appendChild(div);
    });
}

function calcularNotaFinal() {
    let puntosObtenidos = 0;
    Object.values(modalEvalState.evaluaciones).forEach(val => {
        puntosObtenidos += val || 0;
    });
    
    const puntosMaximos = modalEvalState.criterios.reduce((sum, c) => sum + c.puntajeMax, 0);
    const notaFinal = puntosMaximos > 0 ? (puntosObtenidos / puntosMaximos) * modalEvalState.valorActividad : 0;
    
    modalEvalElementos.puntosObtenidos.textContent = puntosObtenidos.toFixed(1);
    modalEvalElementos.notaFinal.textContent = notaFinal.toFixed(2);
}

function cerrarModalEvaluacion() {
    modalEvalElementos.modal.style.display = 'none';
    modalEvalState.evaluaciones = {};
}

async function guardarEvaluacion() {
    modalEvalElementos.btnGuardar.disabled = true;
    modalEvalElementos.btnGuardar.textContent = '⏳ Guardando...';
    
    try {
        const evaluaciones = [];
        modalEvalState.criterios.forEach(criterio => {
            evaluaciones.push({
                orden: criterio.orden,
                calificacion: modalEvalState.evaluaciones[criterio.orden] || 0
            });
        });
        
        const puntosObtenidos = Object.values(modalEvalState.evaluaciones).reduce((sum, val) => sum + (val || 0), 0);
        const puntosMaximos = modalEvalState.criterios.reduce((sum, c) => sum + c.puntajeMax, 0);
        const notaFinal = puntosMaximos > 0 ? (puntosObtenidos / puntosMaximos) * modalEvalState.valorActividad : 0;
        
        const dataEval = {
            action: 'guardarEvaluacionDetallada',
            estudianteId: modalEvalState.estudianteId,
            moduloId: modalEvalState.moduloId,
            raId: modalEvalState.raId,
            numActividad: modalEvalState.numActividad,
            evaluaciones: evaluaciones
        };
        
        const respEval = await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(dataEval)
        });
        
        const resultEval = await respEval.json();
        
        if (!resultEval.success) {
            throw new Error('Error al guardar evaluación detallada');
        }
        
        const dataActividad = {
            action: 'guardarActividad',
            estudianteId: modalEvalState.estudianteId,
            raId: modalEvalState.raId,
            actividadNumero: modalEvalState.numActividad,
            valor: parseFloat(notaFinal.toFixed(2))
        };
        
        const respActividad = await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(dataActividad)
        });
        
        const resultActividad = await respActividad.json();
        
        if (!resultActividad.success) {
            throw new Error('Error al guardar calificación en Actividades');
        }
        
        const notaFinalRedondeada = parseFloat(notaFinal.toFixed(2));
        
        let actividadEnState = state.actividades.find(a => 
            a.estudianteId == modalEvalState.estudianteId && 
            a.numero == modalEvalState.numActividad && 
            a.raId == modalEvalState.raId
        );
        
        if (actividadEnState) {
            actividadEnState.valor = notaFinalRedondeada;
        } else {
            state.actividades.push({
                estudianteId: modalEvalState.estudianteId,
                raId: modalEvalState.raId,
                numero: modalEvalState.numActividad,
                valor: notaFinalRedondeada
            });
        }
        
        const input = document.querySelector(`input[data-estudiante="${modalEvalState.estudianteId}"][data-actividad="${modalEvalState.numActividad}"][data-ra="${modalEvalState.raId}"]`);
        if (input) {
            input.value = notaFinalRedondeada;
            
            const fila = input.closest('tr');
            if (fila) {
                const inputs = fila.querySelectorAll('.input-actividad');
                let total = 0;
                inputs.forEach(inp => {
                    const val = parseFloat(inp.value);
                    if (!isNaN(val)) total += val;
                });
                const celdaTotal = fila.querySelector('.celda-total');
                if (celdaTotal) {
                    celdaTotal.textContent = total.toFixed(2);
                }
            }
        }
        
        cerrarModalEvaluacion();
        
        // Mostrar mensaje elegante
        mostrarMensajeExito('¡Evaluación Guardada!', `Calificación registrada: ${notaFinalRedondeada} pts`);
        
    } catch (error) {
        console.error('Error al guardar evaluación:', error);
        alert('❌ Error al guardar la evaluación');
    } finally {
        modalEvalElementos.btnGuardar.disabled = false;
        modalEvalElementos.btnGuardar.textContent = '💾 Guardar Evaluación';
    }
}

modalEvalElementos.btnCerrar.addEventListener('click', cerrarModalEvaluacion);
modalEvalElementos.btnCancelar.addEventListener('click', cerrarModalEvaluacion);
modalEvalElementos.overlay.addEventListener('click', cerrarModalEvaluacion);
modalEvalElementos.btnGuardar.addEventListener('click', guardarEvaluacion);

// ==========================================
// CACHÉ Y CARGA DE INSTRUMENTOS
// ==========================================

const instrumentosCache = {
    configuraciones: {}
};

async function cargarInstrumentosRA(moduloId, raId) {
    console.log('📋 Precargando instrumentos configurados...');
    
    try {
        const promesas = [];
        
        for (let i = 1; i <= CONFIG.NUM_ACTIVIDADES; i++) {
            const clave = `${moduloId}_${raId}_${i}`;
            
            const promesa = (async () => {
                try {
                    const url = `${CONFIG.GOOGLE_SCRIPT_URL}?action=getInstrumentoActividad&moduloId=${moduloId}&raId=${raId}&numActividad=${i}`;
                    const response = await fetchConTimeout(url);
                    const data = await response.json();
                    
                    if (data.success && data.configurado && data.tipoInstrumento !== 'sin_instrumento') {
                        instrumentosCache.configuraciones[clave] = {
                            tipoInstrumento: data.tipoInstrumento,
                            valorActividad: data.valorActividad
                        };
                    }
                } catch (error) {
                    console.error(`Error al cargar instrumento Ac.${i}:`, error);
                }
            })();
            
            promesas.push(promesa);
        }
        
        await Promise.all(promesas);
        console.log('✅ Instrumentos precargados:', Object.keys(instrumentosCache.configuraciones).length);
        
    } catch (error) {
        console.error('Error al precargar instrumentos:', error);
    }
}

function tieneInstrumentoConfigurado(moduloId, raId, numActividad) {
    const clave = `${moduloId}_${raId}_${numActividad}`;
    return instrumentosCache.configuraciones[clave] || null;
}

function limpiarCacheInstrumentos() {
    instrumentosCache.configuraciones = {};
}

// ==========================================
// INTEGRACIÓN CON TABLA DE ACTIVIDADES
// ==========================================

document.addEventListener('mousedown', function(e) {
    if (e.target.classList.contains('input-actividad')) {
        const input = e.target;
        const celda = input.closest('.celda-actividad-eval');
        
        if (celda) {
            const estudianteId = celda.dataset.estudiante;
            const numActividad = parseInt(celda.dataset.actividad);
            const raId = celda.dataset.ra;
            const moduloId = celda.dataset.modulo;
            
            const instrumento = tieneInstrumentoConfigurado(moduloId, raId, numActividad);
            
            if (instrumento) {
                e.preventDefault();
                e.stopPropagation();
                input.blur();
                abrirModalEvaluacion(estudianteId, moduloId, raId, numActividad);
            }
        }
    }
});

// ==========================================
// MENSAJE DE CONFIRMACIÓN ELEGANTE
// ==========================================

function mostrarMensajeExito(titulo, texto) {
    // Crear overlay
    const overlay = document.createElement('div');
    overlay.className = 'mensaje-confirmacion-overlay';
    
    // Crear mensaje
    const mensaje = document.createElement('div');
    mensaje.className = 'mensaje-confirmacion';
    mensaje.innerHTML = `
        <div class="mensaje-confirmacion-icono">✅</div>
        <div class="mensaje-confirmacion-titulo">${titulo}</div>
        <div class="mensaje-confirmacion-texto">${texto}</div>
        <button class="mensaje-confirmacion-btn" onclick="cerrarMensajeExito(this)">Aceptar</button>
    `;
    
    document.body.appendChild(overlay);
    document.body.appendChild(mensaje);
    
    // Auto-cerrar después de 3 segundos
    setTimeout(() => {
        if (document.body.contains(mensaje)) {
            cerrarMensajeExito(mensaje.querySelector('.mensaje-confirmacion-btn'));
        }
    }, 3000);
}

function cerrarMensajeExito(btn) {
    const mensaje = btn.closest('.mensaje-confirmacion');
    const overlay = document.querySelector('.mensaje-confirmacion-overlay');
    
    if (mensaje) mensaje.remove();
    if (overlay) overlay.remove();
}

// ==========================================
// PWA - SERVICE WORKER Y MODO OFFLINE
// ==========================================

// Registrar Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/Sistema-CJP/sw.js')
            .then(registration => {
                console.log('✅ Service Worker registrado:', registration.scope);
                
                // Verificar actualizaciones periódicamente
                setInterval(() => {
                    registration.update();
                }, 60000); // Cada minuto
                
                // Escuchar mensajes del Service Worker
                navigator.serviceWorker.addEventListener('message', event => {
                    if (event.data && event.data.type === 'SYNC_COMPLETE') {
                        console.log(`✅ ${event.data.count} peticiones sincronizadas`);
                        mostrarNotificacionSincronizacion(event.data.count);
                    }
                });
            })
            .catch(error => {
                console.error('❌ Error al registrar Service Worker:', error);
            });
    });
    
    // Detectar cuando el Service Worker se actualiza
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        console.log('🔄 Nueva versión disponible, recargando...');
        window.location.reload();
    });
}

// Detectar estado de conexión
let isOnline = navigator.onLine;
let offlineQueue = [];

window.addEventListener('online', () => {
    console.log('🌐 Conexión restaurada');
    isOnline = true;
    mostrarMensajeConexion('online');
    
    // Sincronizar datos pendientes
    if ('serviceWorker' in navigator && 'sync' in registration) {
        navigator.serviceWorker.ready.then(registration => {
            return registration.sync.register('sync-offline-data');
        });
    } else {
        // Fallback si no hay Background Sync
        sincronizarColaOffline();
    }
});

window.addEventListener('offline', () => {
    console.log('📡 Sin conexión');
    isOnline = false;
    mostrarMensajeConexion('offline');
});

// Mostrar mensaje de conexión
function mostrarMensajeConexion(status) {
    const mensaje = document.createElement('div');
    mensaje.className = 'mensaje-conexion';
    mensaje.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        border-radius: 10px;
        color: white;
        font-weight: 600;
        z-index: 10003;
        animation: slideInRight 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    if (status === 'online') {
        mensaje.style.background = 'linear-gradient(135deg, #66BB6A, #81C784)';
        mensaje.textContent = '🌐 Conexión restaurada';
    } else {
        mensaje.style.background = 'linear-gradient(135deg, #EF5350, #E57373)';
        mensaje.textContent = '📡 Modo offline - Los datos se guardarán localmente';
    }
    
    document.body.appendChild(mensaje);
    
    setTimeout(() => {
        mensaje.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => mensaje.remove(), 300);
    }, 4000);
}

// Mostrar notificación de sincronización
function mostrarNotificacionSincronizacion(count) {
    mostrarMensajeExito(
        '✅ Datos Sincronizados',
        `${count} ${count === 1 ? 'registro' : 'registros'} sincronizado${count === 1 ? '' : 's'} con el servidor`
    );
}

// Sincronizar cola offline (fallback)
async function sincronizarColaOffline() {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            type: 'SYNC_NOW'
        });
    }
}

// Wrapper para fetch que maneja offline
async function fetchConOffline(url, options = {}) {
    if (!isOnline) {
        console.log('📡 Modo offline, guardando en cola:', url);
        // Intentar desde caché
        const cachedResponse = await caches.match(url);
        if (cachedResponse) {
            return cachedResponse;
        }
        throw new Error('Sin conexión y sin caché disponible');
    }
    
    try {
        return await fetch(url, options);
    } catch (error) {
        console.error('❌ Error en fetch:', error);
        // Intentar desde caché
        const cachedResponse = await caches.match(url);
        if (cachedResponse) {
            console.log('📦 Usando respuesta cacheada');
            return cachedResponse;
        }
        throw error;
    }
}

// Botón de instalación PWA
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    mostrarBotonInstalar();
});

function mostrarBotonInstalar() {
    const btnInstalar = document.createElement('button');
    btnInstalar.id = 'btnInstalarPWA';
    btnInstalar.innerHTML = '📱 Instalar App';
    btnInstalar.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 24px;
        background: linear-gradient(135deg, #5C6BC0, #7986CB);
        color: white;
        border: none;
        border-radius: 50px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(92, 107, 192, 0.4);
        z-index: 1000;
        animation: pulse 2s infinite;
    `;
    
    btnInstalar.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`Usuario ${outcome === 'accepted' ? 'aceptó' : 'rechazó'} instalar la app`);
            deferredPrompt = null;
            btnInstalar.remove();
        }
    });
    
    document.body.appendChild(btnInstalar);
    
    // Auto-ocultar después de 10 segundos
    setTimeout(() => {
        if (btnInstalar.parentNode) {
            btnInstalar.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => btnInstalar.remove(), 300);
        }
    }, 10000);
}

// Agregar animaciones CSS
const style = document.createElement('style');
style.textContent = `
@keyframes slideInRight {
    from {
        transform: translateX(400px);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

@keyframes slideOutRight {
    from {
        transform: translateX(0);
        opacity: 1;
    }
    to {
        transform: translateX(400px);
        opacity: 0;
    }
}

@keyframes pulse {
    0%, 100% {
        transform: scale(1);
    }
    50% {
        transform: scale(1.05);
    }
}
`;
document.head.appendChild(style);

console.log('🚀 PWA inicializado - Estado de conexión:', isOnline ? 'Online' : 'Offline');
