const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());

// Endpoint para recibir la sincronización del outbox de la app móvil
app.post('/api/sync', (req, res) => {
  const { deviceId, actions } = req.body;
  
  console.log(`\n[SYNC] Recibida petición de sincronización de Device ID: ${deviceId}`);
  console.log(`[SYNC] Acciones encoladas recibidas: ${actions ? actions.length : 0}`);

  if (actions && actions.length > 0) {
    actions.forEach((action, index) => {
      console.log(`  -> Acción ${index + 1}: [${action.type}] - Timestamp: ${action.timestamp}`);
      console.log(`     Payload:`, action.payload);
    });
  }

  // Simulamos un procesamiento exitoso
  setTimeout(() => {
    res.status(200).json({
      status: 'success',
      message: 'Sincronización completada',
      processedCount: actions ? actions.length : 0
    });
  }, 500); // Simulamos 500ms de latencia
});

app.listen(port, () => {
  console.log(`[Backend Stub] Escuchando en http://localhost:${port}`);
  console.log(`[Backend Stub] Listo para recibir reportes offline de Network Diagnostics Suite.`);
});
