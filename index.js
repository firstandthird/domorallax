import { prefixedTransform, on, ready, find, styles } from 'domassist';
import Domodule from 'domodule';

const rAF = window.requestAnimationFrame ||
  window.webkitRequestAnimationFrame ||
  window.mozRequestAnimationFrame ||
  window.msRequestAnimationFrame ||
  window.oRequestAnimationFrame ||
  (callback => setTimeout(callback, 1000 / 60));
const transformProp = prefixedTransform();
const wSizes = {};
const oldWSizes = {};
const instances = [];

function updateWSizes() {
  wSizes.width = window.innerWidth || document.documentElement.clientWidth;
  wSizes.height = window.innerHeight || document.documentElement.clientHeight;
}

// rAF Loop
function animate() {
  if (!instances.length) {
    return;
  }

  wSizes.y = window.pageYOffset || (document.documentElement || document.body.parentNode || document.body).scrollTop;

  const isResized = oldWSizes.width !== wSizes.width ||
    oldWSizes.height !== wSizes.height;
  const isScrolled = isResized || oldWSizes.y !== wSizes.y;

  if (isResized || isScrolled) {
    instances.forEach(instance => {
      if (isResized) {
        instance.onResize();
      }

      if (isScrolled) {
        instance.onScroll();
      }
    });
  }

  oldWSizes.width = wSizes.width;
  oldWSizes.height = wSizes.height;
  oldWSizes.y = wSizes.y;

  rAF(animate);
}

updateWSizes();
on(window, 'resize', updateWSizes);
on(window, 'orientationchange', updateWSizes);
on(window, 'load', updateWSizes);

class Domorallax extends Domodule {
  get defaults() {
    return {
      speed: 0.5,
      position: 'fixed'
    };
  }

  postInit() {
    this.options.speed = Math.min(2, Math.max(-1, parseFloat(this.options.speed)));
    // For now let's keep this simple
    this.image = this.el.children[0];

    this.checkEnabled();
  }

  checkEnabled() {
    let enabled = true;

    if (this.options.on) {
      enabled = window.matchMedia(this.options.on).matches;
    }

    if (this.enabled !== enabled) {
      if (enabled) {
        this.checkParents();
      } else {
        // Wipe everything
        this.el.style[transformProp] = '';
        this.image.removeAttribute('style');
      }
    }

    if (enabled) {
      this.calculate();
      this.clip();
      this.onScroll(true);
    }

    this.enabled = enabled;
  }

  checkParents() {
    let parentWithTransform = 0;
    let parent = this.el;

    while (parent !== null && parent !== document && parentWithTransform === 0) {
      const style = window.getComputedStyle(parent);
      const parentTransform = style.getPropertyValue('-webkit-transform') ||
        style.getPropertyValue('transform');

      if (parentTransform && parentTransform !== 'none') {
        parentWithTransform = 1;

        // Add transform on container if there is parent with transform
        this.el.style[transformProp] = 'translateX(0) translateY(0)';
      }

      parent = parent.parentNode;
    }

    if (parentWithTransform) {
      this.options.position = 'absolute';
    }
  }

  clip() {
    if (this.options.position !== 'fixed') {
      return;
    }

    const rect = this.el.getBoundingClientRect();
    const { width, height } = rect;

    if (!this.clipStyles) {
      this.clipStyles = document.createElement('style');
      this.clipStyles.setAttribute('type', 'text/css');
      this.clipStyles.setAttribute('id', `domorallax-clip-${this.id}`);
      const head = document.head || document.getElementsByTagName('head')[0];
      head.appendChild(this.clipStyles);
    }

    const content = [
      `[data-module-uid="${this.id}"] {`,
      `   clip: rect(0 ${width}px ${height}px 0);`,
      `   clip: rect(0, ${width}px, ${height}px, 0);`,
      '}',
    ].join('\n');

    if (this.clipStyles.styleSheet) {
      this.clipStyles.styleSheet.cssText = content;
    } else {
      this.clipStyles.innerHTML = content;
    }
  }

  calculate() {
    const rect = this.el.getBoundingClientRect();
    const elHeight = rect.height;
    const speed = this.options.speed;
    let scrollDist = 0;
    let height = elHeight;

    if (speed < 0) {
      scrollDist = speed * Math.max(elHeight, wSizes.height);
    } else {
      scrollDist = speed * (elHeight + wSizes.height);
    }

    if (speed > 1) {
      height = Math.abs(scrollDist - wSizes.height);
    } else if (speed < 0) {
      height = scrollDist / speed + Math.abs(scrollDist);
    } else {
      height += Math.abs(wSizes.height - elHeight) * (1 - speed);
    }

    scrollDist /= 2;

    const marginTop = (wSizes.height - height) / 2;
    this.scrollDistance = scrollDist;

    styles(this.image, {
      height: `${height}px`,
      marginTop: `${marginTop}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      top: 0,
      pointerEvents: 'none',
      overflow: 'hidden',
      position: this.options.position,
      willChange: 'transform'
    });
  }

  onScroll(force = false) {
    if (!this.enabled) {
      return;
    }

    const rect = this.el.getBoundingClientRect();
    const { top, height } = rect;
    this.elInViewPort = rect.bottom >= 0 &&
      rect.right >= 0 &&
      rect.top <= wSizes.height &&
      rect.left <= wSizes.width;

    // Stop if not in viewport
    if (!force && !this.elInViewPort) {
      return;
    }

    const fromViewportCenter = 1 - 2 * (wSizes.height - top) / (wSizes.height + height);
    let y = (this.scrollDistance * fromViewportCenter);

    if (this.options.position === 'absolute') {
      y -= top;
    }

    this.image.style[transformProp] = `translate3d(0, ${y}px, 0)`;
  }

  onResize() {
    this.checkEnabled();
  }
}

// Control discovery to control rAF process
export default function discover() {
  const els = find('[data-module="Domorallax"]');

  els.forEach(el => {
    if (!el.dataset.moduleUid) {
      instances.push(new Domorallax(el));
    }

    // Don't start the rAF cycle unless at least one
    if (instances.length === 1) {
      animate();
    }
  });
}

ready(discover);
