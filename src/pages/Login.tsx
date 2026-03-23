import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

const LoginPage = () => {
	const { isAuthenticated, isLoading, error, signInWithGoogle } = useAuth();

	if (isAuthenticated) {
		return <Navigate to="/dashboard" replace />;
	}

	return (
		<div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4">
			<div className="pointer-events-none absolute -left-24 top-12 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
			<div className="pointer-events-none absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />

			<main className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur">
				<p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Dispositio Admin</p>
				<h1 className="mt-3 text-3xl font-extrabold text-slate-50">Exam Seating Console</h1>
				<p className="mt-2 text-sm text-slate-300">
					Sign in with Google. We read your email from Supabase and authenticate backend cookies automatically.
				</p>

				{error ? (
					<p className="mt-4 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
						{error}
					</p>
				) : null}

				<button
					type="button"
					onClick={() => {
						signInWithGoogle().catch(() => {
							// Error is handled in auth context.
						});
					}}
					disabled={isLoading}
					className="mt-6 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
				>
					{isLoading ? "Redirecting to Google..." : "Login with Google"}
				</button>
			</main>
		</div>
	);
};

export default LoginPage;
