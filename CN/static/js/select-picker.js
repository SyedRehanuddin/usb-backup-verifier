(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    root.DarkSelectPicker = api.DarkSelectPicker;
    root.calculateSelectMenuPlacement = api.calculateSelectMenuPlacement;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    function calculateSelectMenuPlacement({
        triggerTop,
        triggerBottom,
        triggerLeft,
        triggerWidth,
        viewportWidth,
        viewportHeight,
        desiredHeight,
        gap = 6,
        margin = 8,
    }) {
        const below = Math.max(0, viewportHeight - triggerBottom - gap - margin);
        const above = Math.max(0, triggerTop - gap - margin);
        const opensUp = below < desiredHeight && above > below;
        const availableHeight = opensUp ? above : below;
        const height = Math.min(desiredHeight, availableHeight);
        const maximumLeft = Math.max(margin, viewportWidth - margin - triggerWidth);
        const left = Math.min(Math.max(margin, triggerLeft), maximumLeft);
        const top = opensUp
            ? Math.max(margin, triggerTop - gap - height)
            : triggerBottom + gap;

        return {opensUp, top, left, width: triggerWidth, height, below, above};
    }

    class DarkSelectPicker {
        static instances = new Set();

        constructor(select, rootElement) {
            this.select = select;
            this.root = rootElement;
            this.trigger = rootElement.querySelector('[role="combobox"]');
            this.value = rootElement.querySelector('[data-picker-value]');
            this.list = rootElement.querySelector('[role="listbox"]');
            this.active = -1;

            this.trigger.addEventListener("click", () => {
                if (this.list.hidden) this.open();
                else this.close();
            });
            this.trigger.addEventListener("keydown", (event) => this.onKey(event));
            this.list.addEventListener("pointerdown", (event) => event.preventDefault());
            this.list.addEventListener("pointermove", (event) => {
                const option = event.target.closest('[role="option"]');
                if (option) this.activate(Number(option.dataset.index), false);
            });
            this.list.addEventListener("click", (event) => {
                const option = event.target.closest('[role="option"]');
                if (option && this.list.contains(option)) this.choose(Number(option.dataset.index));
            });
            document.addEventListener("pointerdown", (event) => {
                if (!this.root.contains(event.target)) this.close();
            });
            this.root.addEventListener("focusout", (event) => {
                if (!this.root.contains(event.relatedTarget)) this.close();
            });
            window.addEventListener("resize", () => {
                if (!this.list.hidden) this.position();
            });
            window.addEventListener("scroll", () => {
                if (!this.list.hidden) this.position();
            }, true);

            DarkSelectPicker.instances.add(this);
            this.sync();
        }

        sync() {
            this.close();
            this.trigger.disabled = this.select.disabled;
            this.options = Array.from(this.select.options).filter((option) => !option.disabled);
            const selected = this.select.selectedOptions[0] || this.options[0];
            this.value.textContent = selected?.textContent || "";
            this.list.replaceChildren(...this.options.map((option, index) => {
                const row = document.createElement("div");
                row.id = `${this.list.id}-option-${index}`;
                row.className = "history-picker-option";
                row.setAttribute("role", "option");
                row.setAttribute("aria-label", option.textContent);
                row.setAttribute("aria-selected", String(option.value === this.select.value));
                row.dataset.index = String(index);
                row.textContent = option.textContent;
                return row;
            }));
        }

        position() {
            const triggerRect = this.trigger.getBoundingClientRect();
            const maximumHeight = 220;
            this.list.style.visibility = "hidden";
            this.list.style.width = `${triggerRect.width}px`;
            this.list.style.maxHeight = "none";
            this.list.style.top = "0";
            this.list.style.left = "0";
            this.list.hidden = false;
            const desiredHeight = Math.min(
                maximumHeight,
                Math.ceil(this.list.getBoundingClientRect().height),
            );
            const placement = calculateSelectMenuPlacement({
                triggerTop: triggerRect.top,
                triggerBottom: triggerRect.bottom,
                triggerLeft: triggerRect.left,
                triggerWidth: triggerRect.width,
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
                desiredHeight,
            });
            this.root.classList.toggle("opens-up", placement.opensUp);
            this.list.style.top = `${placement.top}px`;
            this.list.style.left = `${placement.left}px`;
            this.list.style.width = `${placement.width}px`;
            this.list.style.maxHeight = `${placement.height}px`;
            this.list.style.visibility = "";
        }

        open(last = false) {
            if (this.trigger.disabled || !this.options.length) return;
            DarkSelectPicker.instances.forEach((picker) => {
                if (picker !== this) picker.close();
            });
            this.position();
            this.trigger.setAttribute("aria-expanded", "true");
            const selected = this.options.findIndex((option) => option.value === this.select.value);
            this.activate(selected >= 0 ? selected : last ? this.options.length - 1 : 0);
        }

        close() {
            this.list.hidden = true;
            this.trigger.setAttribute("aria-expanded", "false");
            this.trigger.removeAttribute("aria-activedescendant");
            this.root.classList.remove("opens-up");
        }

        activate(index, scroll = true) {
            this.active = Math.max(0, Math.min(index, this.options.length - 1));
            Array.from(this.list.children).forEach((row, rowIndex) => {
                row.classList.toggle("active", rowIndex === this.active);
            });
            const row = this.list.children[this.active];
            if (!row) return;
            this.trigger.setAttribute("aria-activedescendant", row.id);
            if (scroll) {
                const rowRect = row.getBoundingClientRect();
                const listRect = this.list.getBoundingClientRect();
                const top = listRect.top + this.list.clientTop;
                const bottom = top + this.list.clientHeight;
                if (rowRect.top < top) this.list.scrollTop += rowRect.top - top;
                else if (rowRect.bottom > bottom) this.list.scrollTop += rowRect.bottom - bottom;
            }
        }

        choose(index) {
            const option = this.options[index];
            if (this.trigger.disabled || !option) return;
            this.select.value = option.value;
            this.select.dispatchEvent(new Event("change", {bubbles: true}));
            this.sync();
            this.trigger.focus();
        }

        onKey(event) {
            if (this.trigger.disabled) return;
            const key = event.key;
            if (key === "Tab") {
                this.close();
                return;
            }
            if (key === "Escape") {
                if (!this.list.hidden) event.preventDefault();
                this.close();
                return;
            }
            if (!["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(key)) return;
            event.preventDefault();
            if (this.list.hidden) {
                this.open(key === "ArrowUp" || key === "End");
                return;
            }
            if (key === "Enter" || key === " ") {
                this.choose(this.active);
                return;
            }
            if (key === "Home") this.activate(0);
            else if (key === "End") this.activate(this.options.length - 1);
            else this.activate(this.active + (key === "ArrowDown" ? 1 : -1));
        }
    }

    return {DarkSelectPicker, calculateSelectMenuPlacement};
});
