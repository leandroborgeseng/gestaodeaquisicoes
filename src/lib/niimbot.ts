"use client";

// Niimbot B1 BLE UUIDs (reverse-engineered protocol)
const NIIMBOT_SERVICE  = "e7810a71-73ae-499d-8c15-faa9aef0c3f2";
const NIIMBOT_CHAR     = "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f";

// Fallback: Nordic UART Service (some B1 firmware versions)
const NUS_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_TX      = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";

const enum Cmd {
  SetLabelType    = 0x23,
  SetLabelDensity = 0x21,
  StartPrint      = 0x01,
  EndPrint        = 0xf3,
  StartPage       = 0x03,
  EndPage         = 0xe3,
  SetDimension    = 0x13,
  SetQuantity     = 0x15,
  PrintRow        = 0x85,
}

function makePacket(cmd: Cmd, data: number[]): Uint8Array {
  const len = data.length;
  let checksum = cmd ^ len;
  for (const b of data) checksum ^= b;
  return new Uint8Array([0x55, 0x55, cmd, len, ...data, checksum, 0xaa, 0xaa]);
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export class NiimbotPrinter {
  private char: BluetoothRemoteGATTCharacteristic | null = null;
  private device: BluetoothDevice | null = null;

  get connected() { return !!this.char; }
  get name() { return this.device?.name ?? null; }

  async connect(): Promise<void> {
    this.device = await navigator.bluetooth.requestDevice({
      filters: [
        { namePrefix: "B1" },
        { namePrefix: "Niimbot" },
        { namePrefix: "niimbot" },
      ],
      optionalServices: [NIIMBOT_SERVICE, NUS_SERVICE],
    });

    const server = await this.device.gatt!.connect();

    // Try Niimbot-proprietary service first, fall back to Nordic UART
    try {
      const svc = await server.getPrimaryService(NIIMBOT_SERVICE);
      this.char = await svc.getCharacteristic(NIIMBOT_CHAR);
    } catch {
      const svc = await server.getPrimaryService(NUS_SERVICE);
      this.char = await svc.getCharacteristic(NUS_TX);
    }
  }

  disconnect() {
    this.device?.gatt?.disconnect();
    this.device = null;
    this.char = null;
  }

  private async send(cmd: Cmd, data: number[]) {
    if (!this.char) throw new Error("Impressora não conectada");
    const pkt = makePacket(cmd, data);
    // BLE MTU is typically 20 bytes — chunk accordingly
    for (let i = 0; i < pkt.length; i += 20) {
      await this.char.writeValueWithoutResponse(pkt.slice(i, i + 20));
      await sleep(5);
    }
  }

  async printBitmap(imageData: ImageData): Promise<void> {
    const { width, height } = imageData;
    const rowBytes = Math.ceil(width / 8);

    // Convert RGBA to 1-bit monochrome (dark pixel = 1)
    const rows: Uint8Array[] = [];
    for (let y = 0; y < height; y++) {
      const row = new Uint8Array(rowBytes);
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const lum = 0.299 * imageData.data[i] + 0.587 * imageData.data[i + 1] + 0.114 * imageData.data[i + 2];
        if (lum < 128) row[Math.floor(x / 8)] |= 0x80 >> (x % 8);
      }
      rows.push(row);
    }

    await this.send(Cmd.SetLabelType,    [1]);
    await this.send(Cmd.SetLabelDensity, [3]);
    await this.send(Cmd.StartPrint,      [0x01]);
    await this.send(Cmd.StartPage,       [0x01]);
    await this.send(Cmd.SetDimension,    [height >> 8, height & 0xff, width >> 8, width & 0xff]);
    await this.send(Cmd.SetQuantity,     [0x00, 0x01]);

    for (let i = 0; i < rows.length; i++) {
      await this.send(Cmd.PrintRow, [i >> 8, i & 0xff, 1, ...Array.from(rows[i])]);
      // Throttle every 10 rows to avoid overwhelming BLE buffer
      if (i % 10 === 9) await sleep(30);
    }

    await this.send(Cmd.EndPage,  [0x01]);
    await this.send(Cmd.EndPrint, [0x01]);
  }
}

// Niimbot B1: 40mm wide label @ 203 DPI = 320 dots
// Heights: 30mm = 240 dots | 60mm = 480 dots
export const LABEL_W = 320;
export const LABEL_H = 240;
