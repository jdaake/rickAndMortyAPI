<script>
  // import { createEventDispatcher } from "svelte";
  import { fade, fly } from "svelte/transition";
  // const dispatch = createEventDispatcher();
  export let name;
  export let status;
  export let imgUrl;
  export let linkImage;
  export let species;
  export let origin;
  export let gender;
</script>

<style>
  @import url("https://fonts.googleapis.com/css2?family=Permanent+Marker&display=swap");

  h3 {
    font-family: "Permanent Marker", cursive;
    text-align: center;
  }
  .container {
    width: 20%;
    display: inline-flexbox;
    /* border: 1px solid rgba(0, 0, 0, 0.08); */
    box-shadow: 0 2.8px 2.2px rgba(0, 0, 0, 0.02),
      0 6.7px 5.3px rgba(0, 0, 0, 0.028), 0 12.5px 10px rgba(0, 0, 0, 0.035),
      0 22.3px 17.9px rgba(0, 0, 0, 0.042), 0 41.8px 33.4px rgba(0, 0, 0, 0.05),
      0 100px 80px rgba(0, 0, 0, 0.07);
    justify-content: space-between;
    align-items: center;
    margin: 2rem;
    min-width: 275px;
  }

  .image {
    width: 100%;
    display: flex;
  }

  .image img,
  a {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .details {
    /* font-family: "Permanent Marker", cursive; */
    font-size: 1rem;
    font-family: monospace;
    padding: 0.5rem;
    text-align: left;
  }
  div > h3:hover {
    color: rgba(141, 225, 86, 1);
  }
</style>

<div class="container">
  <header class="image uk-inline" uk-lightbox="transition: fade">
    <a href={linkImage}>
      <img src={imgUrl} alt={name} />
      <div class="uk-overlay uk-overlay-primary uk-position-bottom">
        <h3>{name}</h3>
      </div>
    </a>
  </header>
  <div>
    <div class="details">
      <div>Status: {status}</div>
      <hr />
      <div>Species: {species}</div>
      <hr />
      <div>Gender: {gender}</div>
      <hr />
      <div>Origin: {origin}</div>
    </div>
  </div>
</div>
