"use client";

import { useState, useEffect } from "react";
import { Send, Users, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { JOB_CATEGORIES, EXPERIENCE_LEVELS, ETHIOPIAN_LOCATIONS } from "@/lib/constants";


export default function BroadcastPage() {
  
  const [status, setStatus] = useState("all");
  const [onboarding, setOnboarding] = useState("all");
  const [category, setCategory] = useState("all");
  const [location, setLocation] = useState("all");
  const [experience, setExperience] = useState("all");
  const [message, setMessage] = useState("");
  
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Debounced audience calculation
  useEffect(() => {
    const fetchAudience = async () => {
      setIsCalculating(true);
      try {
        const res = await fetch("/api/admin/broadcast/audience", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, onboarding, category, location, experience })
        });
        const data = await res.json();
        if (res.ok) {
          setAudienceCount(data.count);
        } else {
          setAudienceCount(null);
        }
      } catch (e) {
        console.error(e);
        setAudienceCount(null);
      } finally {
        setIsCalculating(false);
      }
    };

    const timer = setTimeout(() => {
      fetchAudience();
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [status, onboarding, category, location, experience]);

  const handleSend = async () => {
    if (!message.trim()) {
      alert("Please enter a message to broadcast.");
      return;
    }
    
    if (audienceCount === 0) {
      alert("Your current filters match 0 users.");
      return;
    }

    if (!confirm(`Are you sure you want to send this message to ${audienceCount} users?`)) {
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch("/api/admin/broadcast/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, onboarding, category, location, experience, message })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        alert(`Message is being sent to ${data.count} users in the background.`);
        setMessage("");
      } else {
        alert(data.error || "Something went wrong.");
      }
    } catch (e) {
      alert("Network error occurred.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Broadcast Message
        </h1>
        <p className="text-sm text-slate-400">
          Target specific user segments and send direct Telegram messages.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-4">
          <Card className="border-slate-800 bg-slate-900/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Target Audience</CardTitle>
              <CardDescription>Filter who receives this message</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="bg-slate-950 border-slate-800">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="inactive">Inactive/Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Onboarding</Label>
                <Select value={onboarding} onValueChange={setOnboarding}>
                  <SelectTrigger className="bg-slate-950 border-slate-800">
                    <SelectValue placeholder="Onboarding" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Onboarding</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="bg-slate-950 border-slate-800">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {JOB_CATEGORIES.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Location</Label>
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger className="bg-slate-950 border-slate-800">
                    <SelectValue placeholder="Location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {ETHIOPIAN_LOCATIONS.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Experience</Label>
                <Select value={experience} onValueChange={setExperience}>
                  <SelectTrigger className="bg-slate-950 border-slate-800">
                    <SelectValue placeholder="Experience" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Experience</SelectItem>
                    {EXPERIENCE_LEVELS.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-sky-900 bg-sky-950/30">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center space-y-2 text-center">
                <div className="p-3 bg-sky-500/20 rounded-full">
                  <Users className="h-6 w-6 text-sky-400" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-slate-400">Matching Audience</h3>
                  <div className="text-3xl font-bold text-white">
                    {isCalculating ? (
                      <Loader2 className="h-8 w-8 animate-spin text-sky-400 mx-auto" />
                    ) : (
                      audienceCount ?? "-"
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    Users who will receive this message
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-4">
          <Card className="border-slate-800 bg-slate-900/70 h-full flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Message Content</CardTitle>
              <CardDescription>Compose the message to send to your selected audience.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col space-y-4">
              <Textarea 
                placeholder="Type your message here..."
                className="flex-1 min-h-[300px] bg-slate-950 border-slate-800 resize-none"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              
              <div className="flex justify-end pt-4 border-t border-slate-800">
                <Button 
                  onClick={handleSend} 
                  disabled={isSending || isCalculating || audienceCount === 0 || !message.trim()}
                  className="gap-2 bg-sky-600 hover:bg-sky-700 text-white"
                >
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {isSending ? "Initiating Broadcast..." : "Send Broadcast"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
