import type { MusicEvent, NoteRequest } from "./types";

export interface EventLogJSON {
  bpm: number;
  beatsPerBar: number;
  events: MusicEvent[];
}

export class EventLog {
  private list: MusicEvent[] = [];
  private nextId = 1;

  constructor(private bpm: number, private readonly beatsPerBar: number) {}

  record(req: NoteRequest): number {
    const id = this.nextId++;
    this.list.push({ ...req, id });
    return id;
  }

  amend(id: number, patch: { durationBeats: number }): void {
    const e = this.list.find((x) => x.id === id);
    if (e) e.durationBeats = patch.durationBeats;
  }

  setBpm(bpm: number): void {
    this.bpm = bpm;
  }

  events(): readonly MusicEvent[] {
    return this.list;
  }

  toJSON(): EventLogJSON {
    return { bpm: this.bpm, beatsPerBar: this.beatsPerBar, events: this.list.map((e) => ({ ...e })) };
  }

  clear(): void {
    this.list = [];
  }
}
