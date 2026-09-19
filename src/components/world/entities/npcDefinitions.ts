import type { DialogueEntry, NPCDefinition } from "@/types";
import portraitNova from "@/assets/art/portrait-nova.jpg";
import portraitAtlas from "@/assets/art/portrait-atlas.jpg";
import portraitKai from "@/assets/art/portrait-kai.jpg";
import portraitJuno from "@/assets/art/portrait-juno.jpg";

/**
 * NPC roster + dialogue scripts (§17, §18).
 *
 * Definitions are static data: the spatial hash is built once from them and
 * proximity queries per frame are pure arithmetic. Dialogue scripts follow
 * the `DialogueEntry` contract so the processor can later be replaced by a
 * backend/LLM stream without touching UI code.
 */

export const NPC_ROSTER: readonly NPCDefinition[] = [
  {
    id: "nova",
    name: "Nova Chen",
    role: "Grid Engineer",
    x: -5.5,
    z: 6.5,
    facing: 0.6,
    accentColor: 0x37e0ff,
    portraitUrl: portraitNova,
    interactRadius: 3.6,
    dialogueId: "nova",
    index: 0,
  },
  {
    id: "atlas",
    name: "ATLAS-9",
    role: "Civic Autonomy Unit",
    x: 6.5,
    z: -7,
    facing: -2.1,
    accentColor: 0x6fa8ff,
    portraitUrl: portraitAtlas,
    interactRadius: 4.0,
    dialogueId: "atlas",
    index: 1,
  },
  {
    id: "kai",
    name: "Kai Mora",
    role: "Street Racer",
    x: 12.5,
    z: 12.5,
    facing: 2.6,
    accentColor: 0xff5fd2,
    portraitUrl: portraitKai,
    interactRadius: 3.4,
    dialogueId: "kai",
    index: 2,
  },
  {
    id: "juno",
    name: "Dr. Juno Ito",
    role: "Orbital Astronomer",
    x: -11,
    z: -4.5,
    facing: 1.2,
    accentColor: 0xffc857,
    portraitUrl: portraitJuno,
    interactRadius: 3.6,
    dialogueId: "juno",
    index: 3,
  },
];

export const DIALOGUE_SCRIPTS: Readonly<Record<string, readonly DialogueEntry[]>> = {
  nova: [
    {
      id: "nova-1",
      speaker: "Nova Chen",
      text: "You found the plaza! The whole district runs on the grid I maintain — every window you see lit up is a circuit I personally blessed.",
      nextId: "nova-2",
    },
    {
      id: "nova-2",
      speaker: "Nova Chen",
      text: "The red coupé by the fountain is yours. Shift is boost — try not to redecorate the skyline with it.",
      nextId: "nova-3",
    },
    {
      id: "nova-3",
      speaker: "Nova Chen",
      text: "When you're ready to leave the atmosphere, press 3 for orbital mode. Juno plotted the transfer herself.",
    },
  ],
  atlas: [
    {
      id: "atlas-1",
      speaker: "ATLAS-9",
      text: "GREETINGS. I am ATLAS-9, civic autonomy unit. Crime in this district: zero. Litter incidents: four. I have logged the litter.",
      nextId: "atlas-2",
    },
    {
      id: "atlas-2",
      speaker: "ATLAS-9",
      text: "Query: do humans always steer with such enthusiasm? My suspension diagnostics can hear the boost from here.",
      nextId: "atlas-3",
    },
    {
      id: "atlas-3",
      speaker: "ATLAS-9",
      text: "Press 2 for low-gravity calibration. I will pretend not to watch you jump over the fountain.",
    },
  ],
  kai: [
    {
      id: "kai-1",
      speaker: "Kai Mora",
      text: "Nice ride. Stock suspension though — you'll want to feather it in the underpass chicane.",
      nextId: "kai-2",
    },
    {
      id: "kai-2",
      speaker: "Kai Mora",
      text: "Handbrake is Space. Tap it mid-corner and the rear steps out — that's not a bug, that's a lifestyle.",
      nextId: "kai-3",
    },
    {
      id: "kai-3",
      speaker: "Kai Mora",
      text: "Beat my ghost time and I'll tell you where the rooftop billboard cams point. R stands the car back up if you stuff it into a tower.",
    },
  ],
  juno: [
    {
      id: "juno-1",
      speaker: "Dr. Juno Ito",
      text: "The sky isn't decoration, you know. That dome overhead is a full scattering model — Rayleigh gradients, Mie forward lobes, the lot.",
      nextId: "juno-2",
    },
    {
      id: "juno-2",
      speaker: "Dr. Juno Ito",
      text: "Out there, five worlds ride Keplerian ellipses around the star. Real elements: semi-major axis, eccentricity, inclination, the works.",
      nextId: "juno-3",
    },
    {
      id: "juno-3",
      speaker: "Dr. Juno Ito",
      text: "In deep space, press X to warp. The simulator will quietly rebase its origin so the floats never notice the distance. My life's work, in one keypress.",
    },
  ],
};

export function getScript(npcId: string): readonly DialogueEntry[] {
  return DIALOGUE_SCRIPTS[npcId] ?? [];
}

export function getNpcDefinition(npcId: string): NPCDefinition | null {
  return NPC_ROSTER.find((n) => n.id === npcId) ?? null;
}
