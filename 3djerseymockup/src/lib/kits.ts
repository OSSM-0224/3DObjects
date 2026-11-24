export type KitId = "yash24" | "ganpati" | "slhs";

export type KitSpec = {
  title: string;
  body: string;
  script?: string;
};

export type Kit = {
  id: KitId;
  index: string;
  name: string;
  edition: string;
  modelUrl: string;
  modelHeight: number;
  initialYaw: number;
  stageNumber: string;
  stageScript: boolean;
  headline: {
    first: string;
    lastLead: string;
    lastAccent: string;
  };
  lede: string;
  specs: [KitSpec, KitSpec, KitSpec];
  badge: {
    mark: string;
    script: boolean;
    meta: [string, string];
  };
};

export const KITS: [Kit, Kit, Kit] = [
  {
    id: "yash24",
    index: "01",
    name: "YASH 24",
    edition: "PLAYER EDITION",
    modelUrl: "/models/jersey-yash24.glb",
    modelHeight: 3.3,
    initialYaw: 0.35,
    stageNumber: "24",
    stageScript: false,
    headline: {
      first: "OWN",
      lastLead: "THE ",
      lastAccent: "MOMENT",
    },
    lede: "The 024 player edition. Short-sleeve cut, all-over brushwork, name and number on the back.",
    specs: [
      {
        title: "CUT",
        body: "Short-sleeve player silhouette with a full-length placket.",
      },
      {
        title: "GRAPHIC",
        body: "All-over brushwork in orange, bone and black.",
      },
      {
        title: "ID",
        body: "Name and number set across the back panel.",
      },
    ],
    badge: {
      mark: "24",
      script: false,
      meta: ["YASH", "PLAYER EDITION"],
    },
  },
  {
    id: "ganpati",
    index: "02",
    name: "GANPATI BLUE",
    edition: "BAPPA EDITION",
    modelUrl: "/models/ganpati-blue.glb",
    modelHeight: 3.3,
    initialYaw: 0.35,
    stageNumber: "ग",
    stageScript: true,
    headline: {
      first: "STAY",
      lastLead: "",
      lastAccent: "BLESSED",
    },
    lede: "The Ganpati blue. Round-neck cut, cyan artwork, and the Bappa blessing across the back.",
    specs: [
      {
        title: "CUT",
        body: "Round neck, short sleeves, and a contrast cuff band.",
      },
      {
        title: "GRAPHIC",
        body: "Cyan-to-navy diagonal wash with Ganpati artwork and a front crest.",
      },
      {
        title: "ID",
        body: "Across the back panel.",
        script: "श्री गणपती बाप्पा मोरया",
      },
    ],
    badge: {
      mark: "ग",
      script: true,
      meta: ["GANPATI", "BLUE EDITION"],
    },
  },
  {
    id: "slhs",
    index: "03",
    name: "SLHS 24",
    edition: "XAVIER EDITION",
    modelUrl: "/models/slhs.glb",
    modelHeight: 3.3,
    initialYaw: 0.35,
    stageNumber: "50",
    stageScript: false,
    headline: {
      first: "WEAR",
      lastLead: "THE ",
      lastAccent: "CREST",
    },
    lede: "The St. Xavier's school edition. Short-sleeve polo cut, maroon marbled cloth, and the 50-year mark and school crest across the chest.",
    specs: [
      {
        title: "CUT",
        body: "Short-sleeve school polo with a contrast cream shoulder yoke.",
      },
      {
        title: "GRAPHIC",
        body: "Deep maroon marbled wash with the 50-year mark and St. Xavier's crest.",
      },
      {
        title: "ID",
        body: "MHATRE and 24 across the back panel.",
      },
    ],
    badge: {
      mark: "24",
      script: false,
      meta: ["MHATRE", "XAVIER EDITION"],
    },
  },
];

export const DEFAULT_KIT = KITS[0];
