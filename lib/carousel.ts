/**
 * The landing carousel's slides, in order. Exports live in public/carousel as
 * WebP (paper clamped to #fff, ≤1600px wide). Adding a slide is one file and
 * one entry here; the carousel reads its length from this list.
 */
export type Slide = {
  src: string;
  width: number;
  height: number;
  alt: string;
  title: string;
  body: string;
};

export const SLIDES: Slide[] = [
  {
    src: "/carousel/already.webp",
    width: 1536,
    height: 1024,
    alt: "Someone relaxes in an armchair with a phone while three notifications sort themselves into Needs you, Can wait and Waiting on you.",
    title: "Sorted before you look.",
    body: "Notifications arrive already triaged: what needs you, what can wait, who is waiting on you.",
  },
  {
    src: "/carousel/calm-workspace.webp",
    width: 1600,
    height: 900,
    alt: "Someone leans back at a desk, thinking, while cards read Reply drafted, Conflicts spotted and Reading pulled.",
    title: "Handled while you think.",
    body: "Replies drafted, calendar conflicts spotted and the reading pulled before the meeting.",
  },
  {
    src: "/carousel/interruptions-to-focus.webp",
    width: 1600,
    height: 900,
    alt: "Notification bells and a knock at the door are paused, and the afternoon becomes focused work at 4:00 PM.",
    title: "Interruptions, held until four.",
    body: "MyPA pauses the pings and the knocks so the afternoon stays yours.",
  },
  {
    src: "/carousel/voice-in-the-city.webp",
    width: 1600,
    height: 900,
    alt: "Someone speaks into a phone while walking through the city; a meeting moves from 9:00 to 11:00, an email is answered and a document is sent.",
    title: "Rescheduled mid-stride.",
    body: "Say it on the walk. The meeting moves, the reply goes out, the file is sent.",
  },
];
