export function encodeNativeMessage(value: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(value), "utf8");
  if (body.length > 1024 * 1024) throw new Error("Native message exceeds Chrome's 1 MB limit");
  const frame = Buffer.allocUnsafe(4 + body.length);
  frame.writeUInt32LE(body.length, 0); body.copy(frame, 4); return frame;
}

export class NativeMessageDecoder {
  private buffer = Buffer.alloc(0);
  push(chunk: Buffer): unknown[] {
    this.buffer = Buffer.concat([this.buffer, chunk]); const values: unknown[] = [];
    while (this.buffer.length >= 4) {
      const length = this.buffer.readUInt32LE(0);
      if (length > 64 * 1024 * 1024) throw new Error("Inbound native message exceeds 64 MB");
      if (this.buffer.length < length + 4) break;
      values.push(JSON.parse(this.buffer.subarray(4, length + 4).toString("utf8")));
      this.buffer = this.buffer.subarray(length + 4);
    }
    return values;
  }
}
