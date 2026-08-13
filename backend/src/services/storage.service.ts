import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(__dirname, '../../data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export class PersistentStore {
  private static getFilePath(filename: string): string {
    return path.join(DATA_DIR, filename);
  }

  public static readJSON<T>(filename: string, fallback: T): T {
    try {
      const filePath = this.getFilePath(filename);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw) as T;
      }
    } catch (err) {
      console.error(`Error reading persistent store ${filename}:`, err);
    }
    return fallback;
  }

  public static writeJSON<T>(filename: string, data: T): void {
    try {
      const filePath = this.getFilePath(filename);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error(`Error writing persistent store ${filename}:`, err);
    }
  }
}
