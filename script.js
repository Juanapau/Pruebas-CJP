// ── Protección de sesión ──────────────────────────────────────────────────────
// Si el usuario no pasó por el login, redirigir automáticamente.
(function() {
    if (!sessionStorage.getItem('scjp_auth')) {
        window.location.replace('index.html');
    }
})();
// ─────────────────────────────────────────────────────────────────────────────

// ── Cerrar sesión ─────────────────────────────────────────────────────────────
function cerrarSesion() {
    // Modal de confirmación al estilo del sistema
    const overlay = document.createElement('div');
    overlay.className = 'mensaje-confirmacion-overlay';

    const modal = document.createElement('div');
    modal.className = 'mensaje-confirmacion';
    modal.innerHTML = `
        <div class="mensaje-confirmacion-icono">⏻</div>
        <div class="mensaje-confirmacion-titulo">Cerrar sesión</div>
        <div class="mensaje-confirmacion-texto">¿Estás seguro que deseas salir del sistema?</div>
        <div style="display:flex; gap:12px; justify-content:center; margin-top:4px;">
            <button class="mensaje-confirmacion-btn" style="background:var(--color-primario);" onclick="confirmarSalida()">Sí, salir</button>
            <button class="mensaje-confirmacion-btn" style="background:#90A4AE;" onclick="cancelarSalida()">Cancelar</button>
        </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(modal);
}

function confirmarSalida() {
    sessionStorage.removeItem('scjp_auth');
    sessionStorage.removeItem('scjp_usuario');
    window.location.replace('index.html');
}

function cancelarSalida() {
    const modal = document.querySelector('.mensaje-confirmacion');
    const overlay = document.querySelector('.mensaje-confirmacion-overlay');
    if (modal) modal.remove();
    if (overlay) overlay.remove();
}
// ─────────────────────────────────────────────────────────────────────────────

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
    // Resetear todos los filtros y tabla
    asistenciaElementos.selectCurso.value = '';
    asistenciaElementos.selectModulo.innerHTML = '<option value="">Seleccione un módulo</option>';
    asistenciaElementos.selectModulo.value = '';
    asistenciaElementos.selectMes.value = '';
    asistenciaElementos.tablaHead.innerHTML = '';
    asistenciaElementos.tablaBody.innerHTML = '';
    // Limpiar estado
    asistenciaState.cursoSeleccionado = null;
    asistenciaState.moduloSeleccionado = null;
    asistenciaState.mesSeleccionado = null;
}

function poblarSelectModulosAsistencia(curso) {
    asistenciaElementos.selectModulo.innerHTML = '<option value="">Seleccione un módulo</option>';
    const modulosFiltrados = curso
        ? state.modulos.filter(m => m.curso === curso)
        : state.modulos;
    modulosFiltrados.forEach(modulo => {
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
    // Resetear módulo y tabla al cambiar curso
    asistenciaElementos.selectModulo.value = '';
    asistenciaElementos.selectMes.value = '';
    asistenciaElementos.tablaHead.innerHTML = '';
    asistenciaElementos.tablaBody.innerHTML = '';
    asistenciaState.moduloSeleccionado = null;
    asistenciaState.mesSeleccionado = null;

    if (!curso) {
        asistenciaState.cursoSeleccionado = null;
        asistenciaElementos.selectModulo.innerHTML = '<option value="">Seleccione un módulo</option>';
        return;
    }
    asistenciaState.cursoSeleccionado = curso;
    // Cargar estudiantes y poblar módulos filtrados por curso
    await cargarEstudiantesAsistencia(curso);
    poblarSelectModulosAsistencia(curso);
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
        if (dia === null) return; // Columna sin día asignado, ignorar
        const estado = obtenerAsistencia(estudianteId, dia).toUpperCase();
        if (estado === 'P') presentes++;
        else if (estado === 'E') excusas++;
        else if (estado === 'A') ausentes++;
        else if (estado === 'F') feriados++;
    });

    // Días trabajados = días con P, E o A (excluyendo feriados y vacíos)
    // Se calculan globalmente: días donde AL MENOS un estudiante tiene registro P/E/A
    const diasTrabajados = calcularDiasTrabajadosGlobal();

    // Cada grupo de 3 excusas = 1 ausencia (no 3).
    // Excusas sueltas (que no completan grupo de 3) cuentan como presencia.
    const excusasComoAusencias = Math.floor(excusas / 3); // grupos completos de 3E
    const excusasSueltas = excusas % 3;                   // excusas que no forman grupo
    const total = presentes + excusasSueltas + (excusasComoAusencias * 2);
    // Explicación: cada grupo de 3E ocupa 3 días pero solo 1 cuenta como ausencia,
    // o sea 2 de esos 3 días "cuentan" → presentes + 2 por cada grupo + excusas sueltas
    // El 100% se basa en los días trabajados (no en el total de columnas)
    const porcentaje = diasTrabajados > 0 ? Math.round((total / diasTrabajados) * 100) : 0;
    return {total, porcentaje};
}

function calcularDiasTrabajadosGlobal() {
    // Cuenta los días que tienen al menos un registro P, E o A de cualquier estudiante.
    // F (feriado) y vacío NO cuentan como día trabajado.
    const diasConActividad = new Set();
    asistenciaState.asistencias.forEach(a => {
        const estado = (a.estado || '').toUpperCase();
        // P = Presente, E = Excusa, A = Ausente → todos son días trabajados
        // F = Feriado → NO es día trabajado
        if (estado === 'P' || estado === 'E' || estado === 'A') {
            diasConActividad.add(Number(a.dia));
        }
    });

    // Fallback: leer directamente del DOM por si el state aún no está sincronizado
    if (diasConActividad.size === 0) {
        document.querySelectorAll('.input-asistencia').forEach(input => {
            const estado = input.value.toUpperCase();
            if (estado === 'P' || estado === 'E' || estado === 'A') {
                diasConActividad.add(Number(input.dataset.dia));
            }
        });
    }

    return diasConActividad.size;
}

function agregarEventosAsistencia() {
    document.querySelectorAll('.input-dia-header').forEach(input => {
        input.addEventListener('change', function() {
            const index = parseInt(this.dataset.diaIndex);
            if (this.value.trim() === '') {
                asistenciaState.diasDelMes[index] = null; // Borrar día → columna vacía
                generarTablaAsistencia();
            } else {
                const nuevoDia = parseInt(this.value);
                if (nuevoDia >= 1 && nuevoDia <= 31) {
                    asistenciaState.diasDelMes[index] = nuevoDia;
                    generarTablaAsistencia();
                }
            }
        });
    });
    document.querySelectorAll('.input-asistencia:not([disabled])').forEach(input => {
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
        mostrarMensajeExito('Sin datos', 'No hay datos de asistencia para guardar.');
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
            asistenciaElementos.btnGuardar.textContent = '✅ Guardado';
            mostrarMensajeExito('¡Asistencia Guardada!', 'El registro de asistencia se guardó exitosamente.');
            setTimeout(() => {
                asistenciaElementos.btnGuardar.textContent = '💾 Guardar';
                asistenciaElementos.btnGuardar.disabled = false;
            }, 2000);
            return;
        } else {
            mostrarMensajeError('Error al guardar', data.error || 'Error desconocido. Intente de nuevo.');
        }
    } catch (error) {
        console.error('Error al guardar asistencia:', error);
        mostrarMensajeError('Error de conexión', 'No se pudo conectar con el servidor. Verifique su conexión.');
    } finally {
        if (asistenciaElementos.btnGuardar.textContent !== '✅ Guardado') {
            asistenciaElementos.btnGuardar.disabled = false;
            asistenciaElementos.btnGuardar.textContent = '💾 Guardar';
        }
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
    // Usa la misma lógica que el cálculo de porcentaje:
    // días trabajados = días con al menos un P, E o A (F no cuenta)
    const diasTrabajados = calcularDiasTrabajadosGlobal();
    document.getElementById('diasTrabajados').textContent = diasTrabajados;
    console.log(`📊 Días trabajados: ${diasTrabajados} (P, E o A cuentan; F no cuenta)`);
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

function mostrarMensajeError(titulo, texto) {
    const overlay = document.createElement('div');
    overlay.className = 'mensaje-confirmacion-overlay';

    const mensaje = document.createElement('div');
    mensaje.className = 'mensaje-confirmacion';
    mensaje.innerHTML = `
        <div class="mensaje-confirmacion-icono">❌</div>
        <div class="mensaje-confirmacion-titulo">${titulo}</div>
        <div class="mensaje-confirmacion-texto">${texto}</div>
        <button class="mensaje-confirmacion-btn" onclick="cerrarMensajeExito(this)">Aceptar</button>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(mensaje);

    // Auto-cerrar después de 4 segundos
    setTimeout(() => {
        if (document.body.contains(mensaje)) {
            cerrarMensajeExito(mensaje.querySelector('.mensaje-confirmacion-btn'));
        }
    }, 4000);
}

// ==========================================
// EXPORTAR REPORTE PDF - CALIFICACIONES
// ==========================================

async function exportarReporteCalificaciones() {
    // Validar que hay datos cargados
    if (!state.moduloSeleccionado || state.ras.length === 0 || state.estudiantes.length === 0) {
        mostrarMensajeError('Sin datos', 'Seleccione un módulo con calificaciones antes de exportar.');
        return;
    }

    const btn = document.getElementById('btnExportarPDF');
    btn.disabled = true;
    btn.textContent = '⏳ Generando...';

    try {
        const { jsPDF } = window.jspdf;

        // Obtener datos del módulo y curso actuales
        const moduloActual = state.modulos.find(m => m.id == state.moduloSeleccionado);
        const nombreModulo = moduloActual ? moduloActual.nombre : 'Módulo';
        const curso = state.cursoSeleccionado || '';
        const fecha = new Date().toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' });
        const anioEscolar = (() => {
            const hoy = new Date();
            const anio = hoy.getFullYear();
            return hoy.getMonth() >= 8 ? `${anio}-${anio + 1}` : `${anio - 1}-${anio}`;
        })();

        // Configurar documento horizontal (landscape) para muchas columnas
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const margen = 14;

        // ── ENCABEZADO ──────────────────────────────────────────────────────────
        const logoBase64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAfQB9ADASIAAhEBAxEB/8QAHQABAAICAwEBAAAAAAAAAAAAAAYHBQgCAwQJAf/EAGEQAQABAwICBQcJBAcFAwgCEwABAgMEBREGIQcSMUFRExQiYXGBkQgyQlJyobHB0RUjM2IkQ4KSorLhCRZTwvA0Y9IlJjZEVHODk6OzGGSk8UVWpcPTFyc3OEZ0dYSUtP/EABsBAQACAwEBAAAAAAAAAAAAAAABBgQFBwMC/8QAQBEBAAEDAgIGCgIBAwIFBAMAAAECAwQFESExBhJBUWGxEyIycYGRocHR8BThI0JS8TM0FSRDYqIWNXKCJURT/9oADAMBAAIRAxEAPwDTIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//9k=';
        const logoSize = 22;
        doc.addImage('data:image/jpeg;base64,' + logoBase64, 'JPEG', margen, 8, logoSize, logoSize);

        // Título principal
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(30, 90, 160);
        doc.text('SISTEMA DE CALIFICACIONES JP', margen + logoSize + 5, 17);

        // Subtítulo institución
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);
        doc.text('Politécnico Nuestra Señora de la Altagracia', margen + logoSize + 5, 24);

        // Línea divisoria
        doc.setDrawColor(30, 90, 160);
        doc.setLineWidth(0.8);
        doc.line(margen, 33, pageW - margen, 33);

        // ── INFO DEL REPORTE ────────────────────────────────────────────────────
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(30, 30, 30);
        doc.text('REPORTE DE CALIFICACIONES', pageW / 2, 41, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);

        // Fila info — módulo y curso a la izquierda, fecha a la derecha
        doc.setFont('helvetica', 'bold');
        doc.text('Módulo:', margen, 49);
        doc.setFont('helvetica', 'normal');
        doc.text(nombreModulo, margen + 16, 49);

        doc.setFont('helvetica', 'bold');
        doc.text('Curso:', margen + 90, 49);
        doc.setFont('helvetica', 'normal');
        doc.text(curso, margen + 103, 49);

        doc.setFont('helvetica', 'bold');
        doc.text('Año escolar:', margen + 155, 49);
        doc.setFont('helvetica', 'normal');
        doc.text(anioEscolar, margen + 178, 49);

        doc.setFont('helvetica', 'bold');
        doc.text('Fecha:', pageW - margen - 50, 49);
        doc.setFont('helvetica', 'normal');
        doc.text(fecha, pageW - margen - 35, 49);

        // ── CONSTRUIR DATOS DE LA TABLA ─────────────────────────────────────────
        // Encabezados: #, Nombre, [Op1 Op2 Op3 por cada RA], Total
        const headRow1 = [
            { content: '#', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: [30, 90, 160], textColor: 255, fontStyle: 'bold', fontSize: 8 } },
            { content: 'Nombre', rowSpan: 2, styles: { halign: 'left', valign: 'middle', fillColor: [30, 90, 160], textColor: 255, fontStyle: 'bold', fontSize: 8 } }
        ];

        state.ras.forEach(ra => {
            headRow1.push({
                content: `${ra.codigo}\n(Valor: ${ra.valorTotal || 0})`,
                colSpan: 3,
                styles: { halign: 'center', fillColor: [30, 90, 160], textColor: 255, fontStyle: 'bold', fontSize: 7.5 }
            });
        });
        headRow1.push({
            content: 'Total',
            rowSpan: 2,
            styles: { halign: 'center', valign: 'middle', fillColor: [20, 60, 120], textColor: 255, fontStyle: 'bold', fontSize: 8 }
        });

        const headRow2 = [];
        state.ras.forEach(ra => {
            const min = Math.round((ra.valorTotal || 0) * 70 / 100);
            headRow2.push({ content: 'Op.1', styles: { halign: 'center', fillColor: [50, 115, 190], textColor: 255, fontStyle: 'bold', fontSize: 7 } });
            headRow2.push({ content: 'Op.2', styles: { halign: 'center', fillColor: [50, 115, 190], textColor: 255, fontStyle: 'bold', fontSize: 7 } });
            headRow2.push({ content: `Op.3\n(Min: ${min})`, styles: { halign: 'center', fillColor: [50, 115, 190], textColor: 255, fontStyle: 'bold', fontSize: 7 } });
        });

        // Filas de datos
        const bodyRows = state.estudiantes.map((est, idx) => {
            const fila = [
                { content: String(est.numero || idx + 1), styles: { halign: 'center', fontSize: 8 } },
                { content: est.nombre, styles: { halign: 'left', fontSize: 8 } }
            ];

            let total = 0;
            state.ras.forEach(ra => {
                const cal = obtenerCalificacion(est.id, ra.id);
                const valorFinal = obtenerUltimoValor(cal);
                total += valorFinal;

                const min = Math.round((ra.valorTotal || 0) * 70 / 100);

                const colorCelda = (v, max) => {
                    if (v === null || v === undefined || v === '') return [255, 255, 255];
                    return Number(v) >= min ? [200, 230, 200] : [255, 210, 210];
                };

                const v1 = cal.op1 !== null && cal.op1 !== undefined ? cal.op1 : '';
                const v2 = cal.op2 !== null && cal.op2 !== undefined ? cal.op2 : '';
                const v3 = cal.op3 !== null && cal.op3 !== undefined ? cal.op3 : '';

                fila.push({ content: String(v1), styles: { halign: 'center', fontSize: 8, fillColor: colorCelda(v1, ra.valorTotal) } });
                fila.push({ content: String(v2), styles: { halign: 'center', fontSize: 8, fillColor: colorCelda(v2, ra.valorTotal) } });
                fila.push({ content: String(v3), styles: { halign: 'center', fontSize: 8, fillColor: colorCelda(v3, ra.valorTotal) } });
            });

            const totalPosible = state.ras.reduce((s, ra) => s + (ra.valorTotal || 0), 0);
            const aprobado = totalPosible > 0 && total >= totalPosible * 0.7;
            fila.push({
                content: String(total),
                styles: {
                    halign: 'center',
                    fontStyle: 'bold',
                    fontSize: 8,
                    fillColor: aprobado ? [180, 230, 180] : [255, 190, 190],
                    textColor: aprobado ? [20, 100, 20] : [160, 20, 20]
                }
            });

            return fila;
        });

        // ── FILA DE TOTALES / RESUMEN ────────────────────────────────────────────
        const resumenFila = [
            { content: '', styles: { fillColor: [230, 240, 255] } },
            { content: 'Promedio grupo', styles: { fontStyle: 'bold', fontSize: 8, fillColor: [230, 240, 255] } }
        ];
        state.ras.forEach(ra => {
            const vals1 = state.estudiantes.map(e => { const c = obtenerCalificacion(e.id, ra.id); return c.op1 ?? null; }).filter(v => v !== null);
            const vals2 = state.estudiantes.map(e => { const c = obtenerCalificacion(e.id, ra.id); return c.op2 ?? null; }).filter(v => v !== null);
            const vals3 = state.estudiantes.map(e => { const c = obtenerCalificacion(e.id, ra.id); return c.op3 ?? null; }).filter(v => v !== null);
            const prom = arr => arr.length ? (arr.reduce((a, b) => a + Number(b), 0) / arr.length).toFixed(1) : '-';
            resumenFila.push({ content: prom(vals1), styles: { halign: 'center', fontStyle: 'bold', fontSize: 8, fillColor: [215, 230, 255] } });
            resumenFila.push({ content: prom(vals2), styles: { halign: 'center', fontStyle: 'bold', fontSize: 8, fillColor: [215, 230, 255] } });
            resumenFila.push({ content: prom(vals3), styles: { halign: 'center', fontStyle: 'bold', fontSize: 8, fillColor: [215, 230, 255] } });
        });
        const totalPromedios = state.ras.reduce((sum, ra) => {
            const finales = state.estudiantes.map(e => obtenerUltimoValor(obtenerCalificacion(e.id, ra.id)));
            return sum + (finales.length ? finales.reduce((a, b) => a + b, 0) / finales.length : 0);
        }, 0);
        resumenFila.push({ content: totalPromedios.toFixed(1), styles: { halign: 'center', fontStyle: 'bold', fontSize: 8, fillColor: [200, 220, 255] } });

        // Calcular ancho de columnas dinámicamente
        const numRAs = state.ras.length;
        const colNameWidth = 52;
        const colNumWidth = 8;
        const colTotalWidth = 14;
        const colOpWidth = Math.min(14, Math.max(10, (pageW - 2 * margen - colNumWidth - colNameWidth - colTotalWidth) / (numRAs * 3)));

        const columnStyles = {
            0: { cellWidth: colNumWidth },
            1: { cellWidth: colNameWidth }
        };
        let colIdx = 2;
        state.ras.forEach(() => {
            columnStyles[colIdx] = { cellWidth: colOpWidth };
            columnStyles[colIdx + 1] = { cellWidth: colOpWidth };
            columnStyles[colIdx + 2] = { cellWidth: colOpWidth };
            colIdx += 3;
        });
        columnStyles[colIdx] = { cellWidth: colTotalWidth };

        // ── DIBUJAR TABLA ────────────────────────────────────────────────────────
        doc.autoTable({
            head: [headRow1, headRow2],
            body: [...bodyRows, resumenFila],
            startY: 55,
            margin: { left: margen, right: margen },
            columnStyles: columnStyles,
            styles: {
                overflow: 'linebreak',
                cellPadding: 2,
                lineColor: [180, 180, 180],
                lineWidth: 0.3,
            },
            alternateRowStyles: { fillColor: [248, 250, 255] },
            tableLineColor: [130, 130, 160],
            tableLineWidth: 0.3,
            didDrawPage: (data) => {
                // Pie de página en cada página
                const pageCount = doc.internal.getNumberOfPages();
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7.5);
                doc.setTextColor(120, 120, 120);
                doc.text(
                    `Página ${data.pageNumber} de ${pageCount} · Sistema de Calificaciones JP — Politécnico Nuestra Señora de la Altagracia · Generado el ${fecha}`,
                    pageW / 2,
                    pageH - 6,
                    { align: 'center' }
                );
                // Línea de pie
                doc.setDrawColor(200, 200, 210);
                doc.setLineWidth(0.3);
                doc.line(margen, pageH - 9, pageW - margen, pageH - 9);
            }
        });

        // ── GUARDAR PDF ──────────────────────────────────────────────────────────
        const nombreArchivo = `Calificaciones_${nombreModulo.replace(/\s+/g, '_')}_${curso}_${new Date().toISOString().slice(0, 10)}.pdf`;
        doc.save(nombreArchivo);

        btn.textContent = '✅ Exportado';
        setTimeout(() => {
            btn.textContent = '📄 Exportar PDF';
            btn.disabled = false;
        }, 2500);

    } catch (error) {
        console.error('Error al exportar PDF:', error);
        mostrarMensajeError('Error al exportar', 'No se pudo generar el PDF. Verifica que jsPDF esté cargado.');
        btn.textContent = '📄 Exportar PDF';
        btn.disabled = false;
    }
}



// ==========================================
// PWA - SERVICE WORKER Y MODO OFFLINE
// ==========================================

// Registrar Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
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
