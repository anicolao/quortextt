import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';
import readline from 'readline';

/**
 * Generic data entry with timestamp.
 */
interface DataEntry {
  id: string;
  data: any;
  timestamp: number;
}

/**
 * Simple file-based storage for user data and sessions.
 * Uses a single .jsonl file with the latest entry for each ID being the current state.
 */
export class DataStorage {
  private dataDir: string;
  private cache: Map<string, any> = new Map();
  private filename: string;

  constructor(dataDir: string, filename: string) {
    this.dataDir = dataDir;
    this.filename = path.join(dataDir, filename);
  }

  /**
   * Initialize the storage by creating necessary directories.
   */
  async initialize(): Promise<void> {
    await this.ensureDataDir();
    await this.loadFromFile();
  }

  /**
   * Ensure the data directory exists.
   */
  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create data directory:', error);
      throw error;
    }
  }

  /**
   * Load all data from file into memory cache.
   * Since files may contain multiple entries for the same ID,
   * we keep only the latest one.
   */
  private async loadFromFile(): Promise<void> {
    try {
      const fileStream = createReadStream(this.filename);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });
      
      for await (const line of rl) {
        if (line.trim()) {
          const entry: DataEntry = JSON.parse(line);
          this.cache.set(entry.id, entry.data);
        }
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet, that's okay
        return;
      }
      throw error;
    }
  }

  /**
   * Set a value for an ID.
   */
  async set(id: string, data: any): Promise<void> {
    // Update cache
    this.cache.set(id, data);
    
    // Append to file
    const entry: DataEntry = {
      id,
      data,
      timestamp: Date.now()
    };
    const line = JSON.stringify(entry) + '\n';
    await fs.appendFile(this.filename, line, 'utf8');
  }

  /**
   * Get a value by ID.
   */
  get(id: string): any | undefined {
    return this.cache.get(id);
  }

  /**
   * Check if an ID exists.
   */
  has(id: string): boolean {
    return this.cache.has(id);
  }

  /**
   * Delete an entry.
   * Note: This only removes from cache. The entry remains in the file
   * but won't be loaded on next restart.
   */
  async delete(id: string): Promise<void> {
    this.cache.delete(id);
    
    // Write a tombstone entry
    const entry: DataEntry = {
      id,
      data: null,
      timestamp: Date.now()
    };
    const line = JSON.stringify(entry) + '\n';
    await fs.appendFile(this.filename, line, 'utf8');
  }

  /**
   * Get all entries.
   */
  getAll(): Map<string, any> {
    return new Map(this.cache);
  }

  /**
   * Get all IDs.
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get all values.
   */
  values(): any[] {
    return Array.from(this.cache.values());
  }

  /**
   * Compact the file by rewriting it with only the latest entries.
   * This should be done periodically to keep file size manageable.
   */
  async compact(): Promise<void> {
    const tempFilename = this.filename + '.tmp';
    
    // Write all current entries to temp file
    const entries: string[] = [];
    for (const [id, data] of this.cache.entries()) {
      if (data !== null) { // Skip deleted entries
        const entry: DataEntry = {
          id,
          data,
          timestamp: Date.now()
        };
        entries.push(JSON.stringify(entry));
      }
    }
    
    await fs.writeFile(tempFilename, entries.join('\n') + '\n', 'utf8');
    
    // Atomic rename
    await fs.rename(tempFilename, this.filename);
  }
}
