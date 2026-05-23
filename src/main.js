import "./styles.css";

const moonVideoUrl = import.meta.env.VITE_MOON_VIDEO_URL?.trim() || "/media/moon.mp4";

const blocks = [
  {
    type: "image",
    src: "/media/way.png",
    alt: "A photographed page titled The Way of Transformation",
    fit: "contain",
    tone: "paper"
  },
  {
    type: "video",
    src: moonVideoUrl,
    label: "Moon loop",
    fit: "cover",
    tone: "night"
  },
  {
    type: "image",
    src: "/media/no-weirdo-prosper.png",
    alt: "A glowing white horse with the words no weirdo loser lame shit formed against me shall prosper",
    fit: "contain",
    tone: "ember"
  }
];

const app = document.querySelector("#app");

function shuffleBlocks(items) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function getBlockOrderSignature(items) {
  return items.map((block) => block.src ?? block.label ?? block.alt ?? block.text ?? block.type).join("\n");
}

function randomizeBlocks(items) {
  const randomized = shuffleBlocks(items);

  try {
    const previousOrder = sessionStorage.getItem("theWayBlockOrder");

    if (randomized.length > 1 && previousOrder === getBlockOrderSignature(randomized)) {
      randomized.push(randomized.shift());
    }

    sessionStorage.setItem("theWayBlockOrder", getBlockOrderSignature(randomized));
  } catch {
    return randomized;
  }

  return randomized;
}

function createMediaBlock(block, index) {
  const section = document.createElement("section");
  section.className = `block block--${block.type} tone-${block.tone ?? "dark"}`;
  section.dataset.index = String(index + 1);
  section.ariaLabel = block.label ?? block.alt ?? `Block ${index + 1}`;

  if (block.type === "image") {
    const image = document.createElement("img");
    image.src = block.src;
    image.alt = block.alt ?? "";
    image.decoding = "async";
    image.className = `media media--${block.fit ?? "cover"}`;
    section.append(image);
  }

  if (block.type === "video") {
    const video = document.createElement("video");
    video.src = block.src;
    video.className = `media media--${block.fit ?? "cover"}`;
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.setAttribute("aria-label", block.label ?? "Video");
    section.append(video);
  }

  if (block.type === "text") {
    const article = document.createElement("article");
    article.className = "text-block";
    article.textContent = block.text ?? "";
    section.append(article);
  }

  return section;
}

app.append(...randomizeBlocks(blocks).map(createMediaBlock));

const videos = [...document.querySelectorAll("video")];

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const video = entry.target;

      if (entry.isIntersecting) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }
  },
  { threshold: 0.35 }
);

videos.forEach((video) => observer.observe(video));
