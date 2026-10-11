import UdpSockets from 'react-native-udp';
import { Buffer } from 'buffer';

// OIDs comunes
export const OIDS = {
  sysDescr: [1, 3, 6, 1, 2, 1, 1, 1, 0],
  sysUpTime: [1, 3, 6, 1, 2, 1, 1, 3, 0],
  sysName: [1, 3, 6, 1, 2, 1, 1, 5, 0],
  ifInOctets1: [1, 3, 6, 1, 2, 1, 2, 2, 1, 10, 1], // RX Traffic interface 1
  ifOutOctets1: [1, 3, 6, 1, 2, 1, 2, 2, 1, 16, 1], // TX Traffic interface 1
};

// Codificador ASN.1 muy básico
class Asn1Encoder {
  static encodeLength(len: number): Buffer {
    if (len < 128) {
      return Buffer.from([len]);
    }
    let lengthBytes = [];
    let l = len;
    while (l > 0) {
      lengthBytes.unshift(l & 0xff);
      l >>= 8;
    }
    return Buffer.from([0x80 | lengthBytes.length, ...lengthBytes]);
  }

  static encodeInteger(value: number): Buffer {
    let intBytes = [];
    let v = value;
    if (v === 0) intBytes = [0];
    else {
      while (v > 0) {
        intBytes.unshift(v & 0xff);
        v >>= 8;
      }
      if (intBytes[0] & 0x80) intBytes.unshift(0); // Sign bit
    }
    return Buffer.concat([Buffer.from([0x02]), this.encodeLength(intBytes.length), Buffer.from(intBytes)]);
  }

  static encodeOctetString(str: string): Buffer {
    const strBuf = Buffer.from(str, 'utf8');
    return Buffer.concat([Buffer.from([0x04]), this.encodeLength(strBuf.length), strBuf]);
  }

  static encodeNull(): Buffer {
    return Buffer.from([0x05, 0x00]);
  }

  static encodeOid(oid: number[]): Buffer {
    let bytes: number[] = [];
    bytes.push(oid[0] * 40 + oid[1]);
    for (let i = 2; i < oid.length; i++) {
      let v = oid[i];
      let tmp = [];
      tmp.push(v & 0x7f);
      v >>= 7;
      while (v > 0) {
        tmp.unshift((v & 0x7f) | 0x80);
        v >>= 7;
      }
      bytes.push(...tmp);
    }
    return Buffer.concat([Buffer.from([0x06]), this.encodeLength(bytes.length), Buffer.from(bytes)]);
  }

  static encodeSequence(buffers: Buffer[]): Buffer {
    const payload = Buffer.concat(buffers);
    return Buffer.concat([Buffer.from([0x30]), this.encodeLength(payload.length), payload]);
  }

  static encodeGetRequest(requestId: number, oids: number[][]): Buffer {
    const varbinds = oids.map(oid => 
      this.encodeSequence([this.encodeOid(oid), this.encodeNull()])
    );
    const varbindList = this.encodeSequence(varbinds);
    const pduPayload = Buffer.concat([
      this.encodeInteger(requestId),
      this.encodeInteger(0), // error-status
      this.encodeInteger(0), // error-index
      varbindList
    ]);
    const pdu = Buffer.concat([Buffer.from([0xa0]), this.encodeLength(pduPayload.length), pduPayload]);
    return pdu;
  }

  static encodeSnmpV2cMessage(community: string, pdu: Buffer): Buffer {
    const version = this.encodeInteger(1); // v2c is 1
    const comm = this.encodeOctetString(community);
    return this.encodeSequence([version, comm, pdu]);
  }
}

// Decodificador ASN.1 muy básico
class Asn1Decoder {
  static parseLength(buf: Buffer, offset: number): { len: number; bytesRead: number } {
    let len = buf[offset];
    if (len < 128) return { len, bytesRead: 1 };
    
    let numBytes = len & 0x7f;
    let actualLen = 0;
    for (let i = 0; i < numBytes; i++) {
      actualLen = (actualLen << 8) | buf[offset + 1 + i];
    }
    return { len: actualLen, bytesRead: 1 + numBytes };
  }

  static extractValues(buf: Buffer): string[] {
    let results: string[] = [];
    let offset = 0;

    // Esto es un parser súper simplificado que busca tipos de datos comunes en las respuestas de SNMP (OctetString, Integer, TimeTicks, Counter32, Gauge32)
    // No mantiene la jerarquía estricta, pero es útil para extraer los valores de un GetResponse.
    while (offset < buf.length) {
      let type = buf[offset];
      offset++;
      let { len, bytesRead } = this.parseLength(buf, offset);
      offset += bytesRead;

      if (type === 0x02 || type === 0x41 || type === 0x42 || type === 0x43) { 
        // Integer (0x02), Counter32 (0x41), Gauge32 (0x42), TimeTicks (0x43)
        let val = 0;
        for (let i = 0; i < len; i++) {
          val = (val << 8) | buf[offset + i];
        }
        results.push(val.toString());
      } else if (type === 0x04) {
        // OctetString
        results.push(buf.toString('utf8', offset, offset + len));
      } else if (type === 0x06) {
        // OID - Ignorar valor aquí, solo avanzar
      } else if (type === 0x05) {
        // Null
      } else if (type === 0x30 || type === 0xA2) {
        // Sequence (0x30) o GetResponse PDU (0xA2), retrocedemos para parsear el contenido
        offset -= len; 
      }
      offset += (type === 0x30 || type === 0xA2) ? 0 : len;
    }
    
    return results;
  }
}

export const snmpGet = (ip: string, oids: number[][], community = 'public', timeoutMs = 2000): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const socket = UdpSockets.createSocket({ type: 'udp4' });
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        socket.close();
        reject(new Error('SNMP Timeout'));
      }
    }, timeoutMs);

    socket.on('message', (msg) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        socket.close();
        
        try {
          const results = Asn1Decoder.extractValues(Buffer.from(msg));
          // Filtramos la comunidad y la version (los primeros elementos en un msj v2c) y request ID, etc.
          // En un parseo real armaríamos el arbol. Como esto es simplificado:
          // Omitimos los primeros valores q suelen ser version, community, request-id, error-status, error-index.
          // Solo dejamos los payload strings/ints reales al final (dependiendo de cuántos oids consultemos).
          const values = results.slice(results.length - oids.length);
          resolve(values);
        } catch (e) {
          reject(new Error('Error decoding SNMP response'));
        }
      }
    });

    socket.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        socket.close();
        reject(err);
      }
    });

    socket.bind(0, '0.0.0.0');

    const requestId = Math.floor(Math.random() * 65535);
    const pdu = Asn1Encoder.encodeGetRequest(requestId, oids);
    const message = Asn1Encoder.encodeSnmpV2cMessage(community, pdu);

    socket.send(message, 0, message.length, 161, ip, (err) => {
      if (err && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        socket.close();
        reject(err);
      }
    });
  });
};
