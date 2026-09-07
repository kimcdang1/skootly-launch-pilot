import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import LaunchHome, {
  LaunchPackEditor,
  LaunchPack,
  LaunchProject,
} from "./pages/Launch";
import AuthPage from "./pages/AuthPage";
import AccountSecurity from "./pages/AccountSecurity";

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-center" />
          <Switch>
            <Route path="/" component={LaunchHome} />
            <Route path="/login" component={AuthPage} />
            <Route path="/account" component={AccountSecurity} />
            <Route path="/pack/new" component={LaunchPackEditor} />
            <Route path="/pack/:id/edit" component={LaunchPackEditor} />
            <Route path="/pack/:id" component={LaunchPack} />
            <Route path="/project/:id" component={LaunchProject} />
            {[
              "/founder",
              "/creator",
              "/onboarding",
              "/coach",
              "/client-success",
              "/history",
              "/lab",
              "/freight-to-freedom",
              "/connect-ai",
            ].map(path => (
              <Route key={path} path={path}>
                <Redirect to="/" />
              </Route>
            ))}
            <Route component={NotFound} />
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
