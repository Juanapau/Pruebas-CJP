==========================================
ESTRUCTURA GOOGLE SHEETS - ASISTENCIA
Sistema de Calificaciones PNSA
==========================================

📊 NOMBRE DE LA HOJA:
--------------------
Formato: Asistencia_{CURSO}_{MODULO_ID}

Ejemplos:
- Asistencia_4toB_MOD001
- Asistencia_5toA_MOD003
- Asistencia_6toC_MOD007

Nota: Se crea una hoja automáticamente por cada combinación de CURSO + MÓDULO


📋 COLUMNAS DE LA HOJA:
----------------------

| Columna | Nombre        | Tipo      | Descripción                                    | Ejemplo           |
|---------|---------------|-----------|------------------------------------------------|-------------------|
| A       | EstudianteID  | Texto     | ID único del estudiante                        | EST001            |
| B       | Mes           | Texto     | Mes en formato YYYY-MM                         | 2025-01           |
| C       | Dia           | Número    | Día del mes (1-31)                            | 15                |
| D       | Estado        | Texto     | Estado de asistencia: P, E, A, F              | P                 |
| E       | Timestamp     | Fecha/Hora| Fecha y hora de guardado                      | 2025-02-17 14:30  |


📝 VALORES PERMITIDOS EN COLUMNA "Estado":
-----------------------------------------
P = Presente
E = Excusa
A = Ausente
F = Feriado


🔧 CREAR LA HOJA MANUALMENTE PARA PRUEBAS:
-----------------------------------------

1. Abre tu Google Spreadsheet
2. Crea una nueva hoja
3. Nómbrala: Asistencia_4toB_MOD001 (o el curso/módulo que uses para pruebas)
4. En la fila 1 (encabezados) escribe:

   A1: EstudianteID
   B1: Mes
   C1: Dia
   D1: Estado
   E1: Timestamp

5. Deja las demás filas vacías (se llenarán automáticamente al guardar)


📊 EJEMPLO DE DATOS:
-------------------

| EstudianteID | Mes     | Dia | Estado | Timestamp           |
|--------------|---------|-----|--------|---------------------|
| EST001       | 2025-01 | 2   | P      | 2025-01-02 08:30:00 |
| EST001       | 2025-01 | 3   | P      | 2025-01-03 08:30:00 |
| EST001       | 2025-01 | 4   | E      | 2025-01-04 08:30:00 |
| EST001       | 2025-01 | 5   | P      | 2025-01-05 08:30:00 |
| EST002       | 2025-01 | 2   | P      | 2025-01-02 08:30:00 |
| EST002       | 2025-01 | 3   | A      | 2025-01-03 08:30:00 |
| EST002       | 2025-01 | 4   | P      | 2025-01-04 08:30:00 |


🔄 FUNCIONAMIENTO DEL GUARDADO:
------------------------------

1. Cuando se presiona "Guardar":
   - Se eliminan TODOS los registros del mes seleccionado
   - Se insertan los nuevos registros
   - Se actualiza el Timestamp con la fecha/hora actual

2. Cada estudiante puede tener múltiples filas (una por día del mes)

3. Solo se guardan los días que tienen un estado (P, E, A, F)
   - Los días vacíos NO se guardan


📌 NOTAS IMPORTANTES:
--------------------

✅ La hoja se crea AUTOMÁTICAMENTE si no existe
✅ Los datos se agrupan por MES (columna B)
✅ Al guardar, se sobreescribe el mes completo
✅ El ID del estudiante debe coincidir con el de la hoja "Estudiantes"
✅ No es necesario crear las hojas manualmente, el sistema las crea


🧪 PARA HACER PRUEBAS:
---------------------

1. Asegúrate de tener estudiantes en la hoja "Estudiantes" con curso 4toB (o el que uses)
2. Asegúrate de tener módulos en la hoja "Modulos"
3. En el sistema:
   - Selecciona Módulo
   - Selecciona Curso
   - Selecciona Mes
4. Escribe P, E, A, o F en las celdas
5. Presiona "Guardar"
6. Verifica en Google Sheets que se creó la hoja y se guardaron los datos


🔍 CONSULTA SQL EQUIVALENTE:
---------------------------

Para obtener asistencias de un estudiante en un mes:

SELECT * FROM Asistencia_4toB_MOD001 
WHERE EstudianteID = 'EST001' 
AND Mes = '2025-01'
ORDER BY Dia ASC;


==========================================
