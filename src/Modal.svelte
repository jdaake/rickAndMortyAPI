<script>
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();
  let characterName;
  let characterStatus;
  let characterSpecies;
  let characterGender;

  export let autofocus;

  function searchCharacters() {
    dispatch("searchCharacters", {
      characterName,
      characterStatus,
      characterSpecies,
      characterGender
    });
  }

  export function resetModal() {
    characterName = "";
    characterStatus = "";
    characterSpecies = "";
    characterGender = "";
    dispatch("closeModal");
  }
</script>

<style>
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
  label {
    display: block;
    margin-bottom: 0.5rem;
    width: 100%;
    font-family: monospace;
  }
</style>

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
      <label for="characterName">
        Name:
        <input
          {autofocus}
          bind:value={characterName}
          type="text"
          name="characterName" />
      </label>
      <label for="characterStatus">
        Status:
        <input
          bind:value={characterStatus}
          uk-tooltip="Dead, alive, or unknown"
          type="text"
          name="characterStatus" />
      </label>
      <label for="characterSpecies">
        Species:
        <input
          bind:value={characterSpecies}
          uk-tooltip="Human, humanoid, robot, unknown, etc."
          type="text"
          name="characterSpecies" />
      </label>
      <label for="characterGender">
        Gender:
        <input
          bind:value={characterGender}
          uk-tooltip="Male or Female"
          type="text"
          name="characterGender" />
      </label>
    </div>
    <div class="uk-modal-footer uk-text-right">
      <button
        class="uk-button uk-button-default uk-modal-close"
        type="button"
        on:click={resetModal}>
        Cancel
      </button>
      <button
        on:click={searchCharacters}
        on:click={resetModal}
        class="uk-button uk-button-default uk-modal-close"
        type="button">
        Go
      </button>
    </div>
  </div>
</div>
