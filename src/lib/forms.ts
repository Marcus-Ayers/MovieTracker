import { startTransition, type FormEvent } from "react";

/**
 * Submit handler for forms backed by `useActionState`.
 * Passing the action to `<form action>` makes React clear every field after it runs, which wipes
 * what you typed when the server sends back an error. Dispatching from onSubmit keeps the form as-is.
 */
export function submitTo(dispatch: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  };
}
