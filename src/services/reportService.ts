import { generatePDF } from 'react-native-html-to-pdf';

export interface ReportData {
  deviceName: string;
  ipAddress: string;
  macAddress?: string;
  diagnostics: {
    command: string;
    output: string;
    timestamp: Date;
  }[];
  evidence: {
    photoUris: string[];
    location?: { latitude: number; longitude: number };
    notes?: string;
  };
}

export class ReportService {
  /**
   * Genera el HTML dinámico para el PDF del reporte.
   */
  private static generateHTML(data: ReportData): string {
    const diagnosticsHtml = data.diagnostics.map(diag => `
      <div class="diagnostic-item">
        <p><strong>Comando:</strong> ${diag.command}</p>
        <p><strong>Fecha:</strong> ${diag.timestamp.toLocaleString()}</p>
        <pre>${diag.output}</pre>
      </div>
    `).join('');

    const photosHtml = data.evidence.photoUris.map(uri => `
      <img src="${uri}" class="evidence-photo" />
    `).join('');

    const locationHtml = data.evidence.location 
      ? `<p><strong>Latitud:</strong> ${data.evidence.location.latitude} <br/> <strong>Longitud:</strong> ${data.evidence.location.longitude}</p>`
      : '<p><em>Ubicación no disponible</em></p>';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Reporte de Diagnóstico - ${data.deviceName}</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; padding: 20px; }
          h1 { color: #0056b3; border-bottom: 2px solid #0056b3; padding-bottom: 10px; }
          h2 { color: #444; margin-top: 30px; }
          .section { margin-bottom: 20px; padding: 15px; background: #f9f9f9; border-radius: 8px; }
          .diagnostic-item { margin-bottom: 15px; border-left: 4px solid #0056b3; padding-left: 10px; }
          pre { background: #2b2b2b; color: #f8f8f2; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 12px; }
          .evidence-photo { max-width: 100%; max-height: 300px; display: block; margin-bottom: 10px; border-radius: 8px; border: 1px solid #ccc; }
        </style>
      </head>
      <body>
        <h1>Reporte de Diagnóstico</h1>
        
        <div class="section">
          <h2>Información del Equipo</h2>
          <p><strong>Nombre:</strong> ${data.deviceName}</p>
          <p><strong>IP:</strong> ${data.ipAddress}</p>
          ${data.macAddress ? `<p><strong>MAC:</strong> ${data.macAddress}</p>` : ''}
        </div>

        <div class="section">
          <h2>Evidencia de Campo</h2>
          ${locationHtml}
          ${data.evidence.notes ? `<p><strong>Notas:</strong> ${data.evidence.notes}</p>` : ''}
          <div class="photos">
            ${photosHtml}
          </div>
        </div>

        <div class="section">
          <h2>Historial de Diagnósticos</h2>
          ${diagnosticsHtml || '<p><em>No hay diagnósticos registrados.</em></p>'}
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Genera y guarda el PDF localmente.
   * Retorna la ruta absoluta donde se guardó el archivo.
   */
  static async generateReportPDF(data: ReportData): Promise<string> {
    const htmlContent = this.generateHTML(data);
    const fileName = `Reporte_${data.deviceName.replace(/\s+/g, '_')}_${Date.now()}`;

    try {
      const options = {
        html: htmlContent,
        fileName: fileName,
        directory: 'Documents', // Se guarda en el directorio Documents del teléfono
      };

      const file = await generatePDF(options);
      
      if (!file.filePath) {
        throw new Error('No se pudo generar la ruta del PDF');
      }

      return file.filePath;
    } catch (error) {
      console.error('Error generando PDF:', error);
      throw error;
    }
  }
}
