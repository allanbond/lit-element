import { LitElement, html } from "lit-element";
// import { customElements } from "@webcomponents/webcomponentsjs";

export class MyButton extends LitElement {
  render() {
    return html`
      <link rel="stylesheet" href="./styles/styles.css" />
      <button class="text-white rounded bg-blue-500 p-2 m-2">
        <slot></slot>
      </button>
    `;
  }
}

customElements.define("my-button", MyButton);
