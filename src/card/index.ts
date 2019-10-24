import { LitElement, html } from "lit-element";
// import { customElements } from "@webcomponents/webcomponentsjs";

export class MyElement extends LitElement {
  render() {
    return html`
      <link rel="stylesheet" href="./styles/styles.css" />
      <p class="text-blue-500">template content</p>
    `;
  }
}

customElements.define("my-element", MyElement);
