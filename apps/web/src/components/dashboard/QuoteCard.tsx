import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

const QUOTES = [
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "It is not enough to have a good mind; the main thing is to use it well.", author: "René Descartes" },
  { text: "Small daily improvements over time lead to stunning results.", author: "Robin Sharma" },
  { text: "First say to yourself what you would be; and then do what you have to do.", author: "Epictetus" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { text: "Your future is created by what you do today, not tomorrow.", author: "Robert Kiyosaki" },
  { text: "Do what you can, with what you have, where you are.", author: "Theodore Roosevelt" },
  { text: "Act as if what you do makes a difference. It does.", author: "William James" },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
];

function getQuoteOfTheDay() {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
  );
  return QUOTES[dayOfYear % QUOTES.length];
}

export function QuoteCard() {
  const [open, setOpen] = useState(true);
  const quote = getQuoteOfTheDay();

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <button
            className="flex w-full items-center justify-between rounded-t-lg p-4 text-left transition-colors hover:bg-muted/30"
            type="button"
          >
            <CardTitle className="flex items-center gap-2">
              <Quote className="h-4 w-4 text-muted-foreground" />
              <span>Daily Quote</span>
            </CardTitle>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200",
                open && "rotate-180"
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <blockquote className="border-l-2 border-muted pl-3">
              <p className="text-sm italic text-card-foreground leading-relaxed">
                "{quote.text}"
              </p>
              <cite className="mt-1 block text-xs not-italic text-muted-foreground">
                — {quote.author}
              </cite>
            </blockquote>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
