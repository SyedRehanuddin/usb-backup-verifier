// Presentation adapter: the existing select remains the workflow's value source.
globalThis.LabTargetPicker = class LabTargetPicker {
    constructor(select) {
        this.select = select;
        this.root = document.querySelector('#lab-target-picker');
        this.trigger = document.querySelector('#lab-target-trigger');
        this.value = document.querySelector('#lab-target-value');
        this.list = document.querySelector('#lab-target-listbox');
        this.active = -1;
        this.search = '';
        this.searchAt = 0;
        this.trigger.addEventListener('click', () => this.list.hidden ? this.open() : this.close());
        this.trigger.addEventListener('keydown', event => this.onKey(event));
        this.list.addEventListener('pointerdown', event => event.preventDefault());
        this.list.addEventListener('click', event => {
            const option = event.target.closest('[role="option"]');
            if (option && this.list.contains(option)) this.choose(Number(option.dataset.index));
        });
        this.list.addEventListener('pointermove', event => {
            const option = event.target.closest('[role="option"]');
            if (option) this.activate(Number(option.dataset.index), false);
        });
        document.addEventListener('pointerdown', event => {
            if (!this.root.contains(event.target)) this.close();
        });
        this.root.addEventListener('focusout', event => {
            if (!this.root.contains(event.relatedTarget)) this.close();
        });
        window.addEventListener('resize', () => this.close());
        this.sync();
    }

    sync() {
        this.close();
        this.trigger.disabled = this.select.disabled;
        const label = this.select.selectedOptions[0]?.textContent || 'Select a target file';
        this.value.textContent = label;
        this.trigger.title = label;
        this.options = Array.from(this.select.options).filter(option => option.value && !option.disabled);
        this.list.replaceChildren(...this.options.map((option, index) => {
            const row = document.createElement('div');
            row.id = `lab-target-option-${index}`;
            row.className = 'lab-target-option';
            row.setAttribute('role', 'option');
            row.setAttribute('aria-label', option.textContent);
            row.setAttribute('aria-selected', String(option.value === this.select.value));
            row.dataset.index = String(index);
            row.textContent = option.textContent;
            row.title = option.textContent;
            return row;
        }));
    }

    open(last = false) {
        if (this.trigger.disabled || !this.options.length) return;
        const rect = this.trigger.getBoundingClientRect();
        const gap = 6;
        const viewportMargin = 8;
        const below = Math.max(0, window.innerHeight - rect.bottom - gap - viewportMargin);
        const above = Math.max(0, rect.top - gap - viewportMargin);
        // Measure the actual wrapped rows at the control's width, rather than
        // treating every dataset as a fixed-height menu.
        this.list.style.visibility = 'hidden';
        this.list.style.maxHeight = 'none';
        this.list.hidden = false;
        const desiredHeight = Math.min(260, Math.ceil(this.list.getBoundingClientRect().height));
        const minimumUsableHeight = Math.min(desiredHeight, 144);
        const upward = below < minimumUsableHeight && above > below;
        this.root.classList.toggle('opens-up', upward);
        this.list.style.maxHeight = `${Math.min(desiredHeight, upward ? above : below)}px`;
        this.list.style.visibility = '';
        this.trigger.setAttribute('aria-expanded', 'true');
        const selected = this.options.findIndex(option => option.value === this.select.value);
        this.activate(selected >= 0 ? selected : last ? this.options.length - 1 : 0);
    }

    close() {
        this.list.hidden = true;
        this.trigger.setAttribute('aria-expanded', 'false');
        this.trigger.removeAttribute('aria-activedescendant');
        this.search = '';
    }

    activate(index, scroll = true) {
        this.active = Math.max(0, Math.min(index, this.options.length - 1));
        Array.from(this.list.children).forEach((row, i) => row.classList.toggle('active', i === this.active));
        const row = this.list.children[this.active];
        if (row) {
            this.trigger.setAttribute('aria-activedescendant', row.id);
            if (scroll) {
                // Scroll only the options, never the page containing the trigger.
                const rowRect = row.getBoundingClientRect();
                const listRect = this.list.getBoundingClientRect();
                const top = listRect.top + this.list.clientTop;
                const bottom = top + this.list.clientHeight;
                if (rowRect.top < top) this.list.scrollTop += rowRect.top - top;
                else if (rowRect.bottom > bottom) this.list.scrollTop += rowRect.bottom - bottom;
            }
        }
    }

    choose(index) {
        if (this.trigger.disabled || !this.options[index]?.value) return;
        this.select.value = this.options[index].value;
        this.close();
        this.select.dispatchEvent(new Event('change', {bubbles: true}));
        this.sync();
        this.trigger.focus();
    }

    onKey(event) {
        if (this.trigger.disabled) return;
        const key = event.key;
        if (key === 'Tab') { this.close(); return; }
        if (key === 'Escape') { event.preventDefault(); this.close(); return; }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(key)) {
            event.preventDefault();
            if (this.list.hidden) {
                this.open(key === 'ArrowUp' || key === 'End');
            } else if (key === 'Enter' || key === ' ') {
                this.choose(this.active);
            } else {
                this.activate(key === 'Home' ? 0 : key === 'End' ? this.options.length - 1 : this.active + (key === 'ArrowDown' ? 1 : -1));
            }
        } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            if (this.list.hidden) this.open();
            const now = Date.now();
            this.search = now - this.searchAt > 750 ? key : this.search + key;
            this.searchAt = now;
            const index = this.options.findIndex(option => option.textContent.toLowerCase().startsWith(this.search.toLowerCase()));
            if (index >= 0) this.activate(index);
        }
    }
};
