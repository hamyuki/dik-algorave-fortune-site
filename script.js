// There are zwei things on this file
// A particle background that runs away from your mouse and bursts when you click
// Three reels with random words that you stop one by one with a button or space

// all the words the reels can land on, mundane things in sweden like tigers
const WORDS = [
  "moon", "river", "stranger", "coin", "storm", "mirror", "garden", "secret",
  "bridge", "fire", "letter", "shadow", "key", "ocean", "dream", "tiger",
  "clock", "forest", "gold", "whisper", "door", "star", "journey", "thunder",
  "feather", "map", "candle", "wolf", "silence", "sun"
];

// grabbing the html elements I need to change from here
const container = document.getElementById("pixi-container");
const button = document.getElementById("spin-button");
const wordsLine = document.getElementById("fortune-words");
const fortuneLine = document.getElementById("fortune-text");

// picks a few different random words (shuffle the list then take the first ones)
function pickWords(count) {
  const copy = [...WORDS].sort(() => Math.random() - 0.5);
  return copy.slice(0, count);
}

// how many words are on one reel's strip
const REEL_WORDS = 8;

// each reel is an object that remembers its own stuff.
// state goes spinning then stopping then snapping and stopped
// offset is how far the strip has scrolled counted in rows instead of pixels
// so it still works if the window gets resized
const reels = [0, 1, 2].map(() => ({
  words: pickWords(REEL_WORDS),
  offset: Math.random() * REEL_WORDS,
  speed: 0.3,
  state: "spinning",
  texts: []
}));

// keeps track of where the mouse is (starts far away so nothing reacts at first)
const pointer = { x: -9999, y: -9999 };

// Pixi v8 needs await to start up so I wrap everything in one async function
async function start() {

  // make the Pixi app and put its canvas inside my div
  const app = new PIXI.Application();
  await app.init({
    resizeTo: container,   // canvas always follows the size of the div
    background: "#080000",
    antialias: true        // smoother edges
  });
  container.appendChild(app.canvas);

  // three layers so I decide what is drawn on top of what
  // particles at the back reels in the middle sparks at the front
  const particleLayer = new PIXI.Container();
  const reelLayer = new PIXI.Container();
  const sparkLayer = new PIXI.Container();
  app.stage.addChild(particleLayer, reelLayer, sparkLayer);

  // the stage ignores the mouse unless I set it to static
  // hitArea makes the whole canvas count as clickable
  app.stage.eventMode = "static";
  app.stage.hitArea = app.screen;

  // a bunch of small dots that float around at random. This is all for the background effect.
  const dots = [];
  for (let i = 0; i < 110; i++) {
    // draw a white circle and then colour it with tint
    const g = new PIXI.Graphics().circle(0, 0, 2 + Math.random() * 3).fill(0xffffff);
    g.tint = Math.random() < 0.5 ? 0xb81c1c : 0xff3333; // dim or bright red
    g.alpha = 0.3 + Math.random() * 0.5;                // some more see-through than others
    g.x = Math.random() * app.screen.width;
    g.y = Math.random() * app.screen.height;
    // I stick my own speed values onto the object so every dot moves differently
    g.vx = (Math.random() - 0.5) * 0.6;
    g.vy = (Math.random() - 0.5) * 0.6;
    particleLayer.addChild(g);
    dots.push(g);
  }

  // sparks are short lived dots that fly out in all directions and fade away
  const sparks = [];
  function burst(x, y, amount = 24) {
    for (let i = 0; i < amount; i++) {
      const s = new PIXI.Graphics().circle(0, 0, 3).fill(0xffffff);
      s.tint = Math.random() < 0.5 ? 0xff3333 : 0xb81c1c;
      s.x = x;
      s.y = y;
      // random direction (an angle) and a random power
      const angle = Math.random() * Math.PI * 2;
      const power = 2 + Math.random() * 5;
      s.vx = Math.cos(angle) * power;
      s.vy = Math.sin(angle) * power;
      s.life = 1; // counts down to 0 then the spark gets deleted
      sparkLayer.addChild(s);
      sparks.push(s);
    }
  }

  // save the mouse position every time it moves
  app.stage.on("pointermove", (e) => {
    pointer.x = e.global.x;
    pointer.y = e.global.y;
  });
  // when the mouse leaves the canvas move it far away so nothing keeps reacting
  app.stage.on("pointerleave", () => { pointer.x = -9999; pointer.y = -9999; });
  // when you click the canvas create sparks and a little shockwave that shoves nearby dots away
  app.stage.on("pointerdown", (e) => {
    burst(e.global.x, e.global.y);
    for (const d of dots) {
      const dx = d.x - e.global.x;
      const dy = d.y - e.global.y;
      const dist = Math.hypot(dx, dy) || 1; // || 1 so I never divide by zero
      if (dist < 200) {
        d.vx += (dx / dist) * 6;
        d.vy += (dy / dist) * 6;
      }
    }
  });

  // height of one row of text. gets recalculated whenever the layout is built
  let rowH = 60;

  // Where on the reel is word number i? 0 is the top 2 is the middle row.
  // The % stuff makes it wrap around so the strip loops forever.
  function posOf(reel, i) {
    return (((i + reel.offset) % REEL_WORDS) + REEL_WORDS) % REEL_WORDS;
  }

  // Draws all the reel graphics. I call it once at the start and again whenever the window is resized so everything stays centred.
  function buildReels() {
    // clear out the old stuff first
    for (const c of reelLayer.removeChildren()) c.destroy({ children: true });

    const w = app.screen.width;
    const h = app.screen.height;
    rowH = Math.max(36, Math.min(70, h * 0.14));
    const reelW = Math.min(w * 0.28, 220);
    const gap = reelW * 0.1;
    const startX = (w - (3 * reelW + 2 * gap)) / 2; // centres the three reels
    const top = h / 2 - 1.5 * rowH;

    reels.forEach((reel, r) => {
      const node = new PIXI.Container();
      node.x = startX + r * (reelW + gap);
      node.y = top;
      node.reelWidth = reelW;

      // dark box behind the words
      const bg = new PIXI.Graphics().roundRect(0, 0, reelW, rowH * 3, 12).fill(0x1a0000);
      // outline around the middle row that's the "winning line"
      const band = new PIXI.Graphics().roundRect(0, rowH, reelW, rowH, 8)
        .stroke({ width: 3, color: 0xff3333 });
      // the mask hides everything that sticks out of the reel window
      const mask = new PIXI.Graphics().roundRect(0, 0, reelW, rowH * 3, 12).fill(0xffffff);

      node.addChild(bg, mask);

      // one text object for every word on the strip
      reel.texts = reel.words.map((word) => {
        const t = new PIXI.Text({
          text: word.toUpperCase(),
          style: { fontFamily: "Courier New", fontSize: rowH * 0.5, fontWeight: "bold", fill: 0xb81c1c }
        });
        t.anchor.set(0.5); // so x and y point at the middle of the word
        t.x = reelW / 2;
        node.addChild(t);
        return t;
      });

      node.addChild(band);
      reel.texts.forEach((t) => (t.mask = mask)); // only the words get masked not the outline
      reel.node = node;
      reelLayer.addChild(node);
    });
  }
  buildReels();
  // rebuild when the canvas changes size
  app.renderer.on("resize", buildReels);

  // finds which word is closest to the middle row right now
  function middleWord(reel) {
    let best = 0;
    for (let i = 0; i < REEL_WORDS; i++) {
      if (Math.abs(posOf(reel, i) - 2) < Math.abs(posOf(reel, best) - 2)) best = i;
    }
    return best;
  }

  // starts a new round with fresh words
  function resetGame() {
    clearInterval(typeTimer); // stop any typing that is still going
    wordsLine.textContent = "";
    fortuneLine.textContent = "Stop all three reels to reveal your fortune...";
    reels.forEach((reel) => {
      reel.words = pickWords(REEL_WORDS);
      reel.speed = 0.3;
      reel.state = "spinning";
    });
    buildReels(); // rebuild because the words changed
    button.textContent = "STOP";
  }

  // puts the three words into a sentence so the page does something. In our real project this step uses local AI.
  function makeFortune(words) {
    return `A ${words[0]} will lead you to the ${words[1]}, but beware of the ${words[2]}.`;
  }

  // types text out one letter at a time like an old terminal
  let typeTimer = null;
  function typeText(el, text) {
    clearInterval(typeTimer); // in case something is still typing
    el.textContent = "";
    let i = 0;
    typeTimer = setInterval(() => {
      el.textContent += text[i++];
      if (i >= text.length) clearInterval(typeTimer);
    }, 35); // milliseconds per letter lower = faster
  }

  // runs once when the last reel has stopped
  function onAllStopped() {
    const finalWords = reels.map((reel) => reel.words[middleWord(reel)]);
    wordsLine.textContent = finalWords.join("  \u2022  ").toUpperCase();
    typeText(fortuneLine, makeFortune(finalWords));
    button.textContent = "SPIN AGAIN";
  }

  // each press stops the next reel that is still spinning (left to right)
  function pressButton() {
    const next = reels.find((reel) => reel.state === "spinning");
    if (next) {
      next.state = "stopping";
      return;
    }
    // if everything has stopped pressing again starts a new round
    if (reels.every((reel) => reel.state === "stopped")) resetGame();
  }

  // there are two ways to spin using either the button on the page or the space bar.
  button.addEventListener("click", pressButton);
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault(); // otherwise space scrolls the page down
      pressButton();
    }
  });

  // Pixi runs this every frame, roughly 60 times a second.
  // dt (deltaTime) keeps the speed the same on slow and fast computers.
  app.ticker.add((ticker) => {
    const dt = ticker.deltaTime;

    // particles drift around get pushed by the mouse and wrap at the edges
    for (const d of dots) {
      const dx = d.x - pointer.x;
      const dy = d.y - pointer.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < 120) { // only dots close to the mouse get pushed
        d.vx += (dx / dist) * 0.15 * dt;
        d.vy += (dy / dist) * 0.15 * dt;
      }
      // friction so they slowly calm down again after being pushed
      d.vx *= 0.985;
      d.vy *= 0.985;
      d.x += (d.vx + 0.05) * dt; // the +0.05 is a tiny constant drift to the right
      d.y += d.vy * dt;
      // leave on one side come back on the other
      if (d.x < 0) d.x = app.screen.width;
      if (d.x > app.screen.width) d.x = 0;
      if (d.y < 0) d.y = app.screen.height;
      if (d.y > app.screen.height) d.y = 0;
    }

    // sparks move, fade out and get removed when they're done
    // (looping backwards so removing items doesn't mess up the loop)
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= 0.02 * dt;
      s.alpha = Math.max(s.life, 0);
      if (s.life <= 0) {
        sparkLayer.removeChild(s);
        s.destroy();
        sparks.splice(i, 1);
      }
    }

    // reels
    reels.forEach((reel) => {
      if (reel.state === "spinning") {
        // just keep scrolling
        reel.offset += reel.speed * dt;
      } else if (reel.state === "stopping") {
        // slow down a little each frame then switch to snapping when it's slow enough
        reel.speed *= Math.pow(0.96, dt);
        reel.offset += reel.speed * dt;
        if (reel.speed < 0.04) reel.state = "snapping";
      } else if (reel.state === "snapping") {
        // slide the closest word into the middle row
        const delta = 2 - posOf(reel, middleWord(reel));
        reel.offset += delta * 0.15 * dt;
        if (Math.abs(delta) < 0.01) {
          // close enough lock it in
          reel.offset += delta;
          reel.state = "stopped";
          // little firework from the reel that just stopped
          const n = reel.node;
          burst(n.x + n.reelWidth / 2, n.y + rowH * 1.5, 18);
          // if that was the last one thenshow the fortune
          if (reels.every((r) => r.state === "stopped")) onAllStopped();
        }
      }

      // put every word at its correct height and light up the middle one when stopped
      const mid = middleWord(reel);
      reel.texts.forEach((t, i) => {
        t.y = posOf(reel, i) * rowH - rowH + rowH / 2;
        t.style.fill = (reel.state === "stopped" && i === mid) ? 0xff9999 : 0xb81c1c;
      });
    });
  });
}

start();
