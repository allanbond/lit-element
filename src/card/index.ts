import { LitElement, html } from "lit-element";
// import { customElements } from "@webcomponents/webcomponentsjs";

export class MyCard extends LitElement {
    render() {
        return html`
      <link rel="stylesheet" href="./styles/styles.css" />
      <p class="p-8 m-4 border border-gray-400 rounded text-blue-500">
        My Card
        <slot></slot>
      </p>
    `;
    }
}

debugger;
customElements.define("my-card", MyCard);
