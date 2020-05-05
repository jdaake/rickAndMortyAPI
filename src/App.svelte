<script>
  import Card from "./Card.svelte";
  import ErrorAlert from "./ErrorAlert.svelte";
  import { fade } from "svelte/transition";
  let hasCharacters = false;
  let characters = [];
  let nextPage;
  let previousPage;
  let characterName;
  let characterStatus;
  let characterSpecies;
  let characterGender;
  let hasError = false;
  let prevIsDisabled;
  let nextIsDisabled;

  function checkPages() {
    if (!nextPage || nextPage == "") {
      nextIsDisabled = true;
    } else {
      nextIsDisabled = false;
    }
    if (!previousPage || previousPage == "") {
      prevIsDisabled = true;
    } else {
      prevIsDisabled = false;
    }
  }

  function resetCharacters() {
    characters = [];
    hasCharacters = false;
    hasError = false;
  }

  function resetModal() {
    characterName = "";
    characterStatus = "";
    characterSpecies = "";
    characterGender = "";
  }

  async function getCharacters() {
    hasError = false;
    await fetch(`https://rickandmortyapi.com/api/character/`)
      .then(res => {
        return res.json();
      })
      .then(data => {
        characters = data.results;
        hasCharacters = true;
        nextPage = data.info.next ? data.info.next : "";
        previousPage = data.info.prev ? data.info.prev : "";
      })
      .catch(err => {
        console.log(err);
      });
    checkPages();
  }

  async function getNextPage() {
    await fetch(nextPage)
      .then(res => {
        return res.json();
      })
      .then(data => {
        characters = data.results;
        nextPage = data.info.next ? data.info.next : "";
        previousPage = data.info.prev ? data.info.prev : "";
        hasCharacters = true;
      })
      .catch(err => {
        console.log(err);
      });
    checkPages();
  }

  async function getPreviousPage() {
    await fetch(previousPage)
      .then(res => {
        return res.json();
      })
      .then(data => {
        characters = data.results;
        nextPage = data.info.next ? data.info.next : "";
        previousPage = data.info.prev ? data.info.prev : "";
        hasCharacters = true;
      })
      .catch(err => {
        console.log(err);
      });
    checkPages();
  }

  async function searchCharacters(name, status, species, gender) {
    let hasName = !name ? "" : name;
    let hasStatus = !status ? "" : status;
    let hasSpecies = !species ? "" : species;
    let hasGender = !gender ? "" : gender;
    hasError = false;
    await fetch(
      `https://rickandmortyapi.com/api/character/?name=${hasName}&status=${hasStatus}&species=${hasSpecies}&gender=${hasGender}`
    )
      .then(res => {
        if (!res.ok) {
          hasCharacters = false;
          hasError = true;
          return;
        } else {
          return res.json();
        }
      })
      .then(data => {
        characters = data.results;
        nextPage = data.info.next;
        previousPage = data.info.prev;
        hasCharacters = true;
      })
      .catch(err => {
        console.log(err);
      });
    checkPages();
    resetModal();
  }
</script>

<style>
  @import url("https://fonts.googleapis.com/css2?family=Permanent+Marker&display=swap");

  h3 {
    font-family: "Permanent Marker", cursive;
    text-align: center;
    padding: 0 1.5rem 0 1.5rem;
  }
  h2 {
    font-family: monospace;
  }
  .container {
    margin: auto;
    margin-top: 2rem;
    width: 85%;
  }

  section {
    display: flex;
    flex-flow: row wrap;
    align-content: flex-start;
    justify-content: center;
    margin: auto;
  }
  section > img {
    min-width: 275px;
    width: 600px;
  }

  input {
    display: block;
    width: 100%;
    font: inherit;
    border: none;
    border-bottom: 2px solid #ccc;
    border-radius: 3px 3px 0 0;
    background: white;
    padding: 0.15rem 0.25rem;
    transition: border-color 0.1s ease-out;
    margin-bottom: 0.8rem;
  }

  input:focus {
    border-color: rgba(141, 225, 86, 1);
    outline: none;
  }

  span {
    display: block;
    margin-bottom: 0.5rem;
    width: 100%;
    font-family: monospace;
  }

  button.toTop {
    margin-top: -1rem;
  }
  button {
    margin: 0.5rem;
  }
  button:hover:enabled {
    color: rgba(141, 225, 86, 1);
    background-color: #333333;
  }

  @media (min-width: 768px) {
    section {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  @media (max-width: 592px) {
    section > button {
      margin-bottom: 0.8rem;
    }
  }
</style>

<div class="container">
  <section class="uk-margin-bottom">
    <button class="uk-button uk-button-default " on:click={getCharacters}>
      Get All Characters
    </button>
    <button
      class="uk-button uk-button-default"
      href="#search-modal"
      uk-toggle
      on:click={() => (hasError = false)}>
      <i class="fas fa-search" />
      Search
    </button>
  </section>
</div>
{#if hasCharacters}
  <section in:fade={{ delay: 1000 }} out:fade={{ delay: 0 }}>
    {#if previousPage != '' || nextPage != ''}
      <button
        class="uk-button uk-button-default mainButton"
        on:click={getPreviousPage}
        disabled={prevIsDisabled}>
        <i class="fas fa-arrow-left" />
      </button>
      <button
        class="uk-button uk-button-default mainButton"
        on:click={getNextPage}
        disabled={nextIsDisabled}>
        <i class="fas fa-arrow-right" />
      </button>
    {/if}
    <button
      in:fade={{ delay: 1000 }}
      out:fade={{ delay: 0 }}
      class="uk-button uk-button-default"
      on:click={resetCharacters}>
      Clear All Characters
    </button>
  </section>
  <section in:fade={{ delay: 1000 }} out:fade={{ delay: 0 }}>
    {#each characters as character}
      <Card
        on:click
        name={character.name}
        status={character.status}
        species={character.species}
        gender={character.gender}
        origin={character.origin.name}
        imgUrl={character.image}
        linkImage={character.image} />
    {/each}
  </section>
{:else if hasCharacters || !hasError}
  <section in:fade={{ delay: 500 }} out:fade>
    <h3>
      Search for your favorite Rick and Morty characters or Get All to browse.
    </h3>
  </section>
  <section in:fade={{ delay: 500 }} out:fade>
    <img
      src="https://media.giphy.com/media/3o7aD2d7hy9ktXNDP2/source.gif"
      alt="portal" />
  </section>
{/if}

<!-- Search Modal -->
<!-- Need to move to own component and figure out how to pass values to app.svelte -->
<div id="search-modal" uk-modal>
  <div class="uk-modal-dialog">
    <button
      class="uk-modal-close-default"
      type="button"
      uk-close
      on:click={resetModal} />
    <div class="uk-modal-header">
      <h2 class="uk-modal-title">
        Search for your favorite Rick and Morty Characters!
      </h2>
    </div>
    <div class="uk-modal-body">
      <span for="characterName">Name:</span>
      <input
        bind:value={characterName}
        uk-tooltip="Enter Character Name"
        type="text"
        name="characterName" />
      <span for="characterStatus">Status:</span>
      <input
        bind:value={characterStatus}
        uk-tooltip="Dead, alive, or unknown"
        type="text"
        name="characterStatus" />
      <span for="characterSpecies">Species:</span>
      <input
        bind:value={characterSpecies}
        uk-tooltip="Human, robot, unknown, etc."
        type="text"
        name="characterSpecies" />
      <span for="characterGender">Gender:</span>
      <input
        bind:value={characterGender}
        uk-tooltip="Male or Female"
        type="text"
        name="characterGender" />
    </div>
    <div class="uk-modal-footer uk-text-right">
      <button
        class="uk-button uk-button-default uk-modal-close"
        type="button"
        on:click={resetModal}>
        Cancel
      </button>
      <button
        on:click={searchCharacters(characterName, characterStatus, characterSpecies, characterGender)}
        class="uk-button uk-button-default uk-modal-close"
        type="button">
        Go
      </button>
    </div>
  </div>
</div>

<!-- Bottom page nav -->
{#if hasCharacters}
  <section
    in:fade={{ delay: 1000 }}
    out:fade={{ delay: 0 }}
    class="uk-margin-bottom">
    {#if previousPage != '' || nextPage != ''}
      <button
        class="uk-button uk-button-default"
        on:click={getPreviousPage}
        disabled={prevIsDisabled}>
        <i class="fas fa-arrow-left" />
      </button>
      <button
        class="uk-button uk-button-default"
        on:click={getNextPage}
        disabled={nextIsDisabled}>
        <i class="fas fa-arrow-right" />
      </button>
    {/if}
  </section>
  <section>
    <button
      class="uk-button uk-button-default toTop"
      uk-tooltip="Back to Top"
      on:click={() => {
        location.href = '#home';
      }}>
      <i class="fas fa-arrow-up" />
    </button>
  </section>
{/if}

<!-- Error -->
{#if hasError}
  <section>
    <ErrorAlert {hasError} />
  </section>
{/if}
