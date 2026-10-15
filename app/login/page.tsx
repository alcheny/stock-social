import { login } from '../actions.ts';

export default function Login() {
  return (
    <main className="page">
      <h1>Publish your trades</h1>
      <p className="muted">Dev sign-in (no password). Replaced by real auth before launch.</p>
      <form action={login}>
        <label htmlFor="handle">Handle</label>
        <input id="handle" name="handle" type="text" required pattern="[a-z0-9_]{3,20}" placeholder="lowercase, 3–20 chars" />
        <label htmlFor="name">Display name</label>
        <input id="name" name="name" type="text" maxLength={40} />
        <label className="check"><input type="checkbox" name="adult" required /> I am 18 or older</label>
        <p><button>Continue</button></p>
      </form>
    </main>
  );
}
