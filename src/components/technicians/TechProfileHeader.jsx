import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Mail, MapPin, Edit2, Save, X, Copy, PhoneCall } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const EQUIPMENT_OPTIONS = ["Samsara", "Geotab", "Zonar", "AIM4", "Cameras", "Printers", "ELD", "Asset Tracking", "Dashcam", "GPS"];

const STATUS_COLORS = {
  active: "bg-emerald-100 text-emerald-800 border-emerald-200",
  on_leave: "bg-amber-100 text-amber-800 border-amber-200",
  inactive: "bg-gray-100 text-gray-500 border-gray-200",
};

const TRAINING_COLORS = {
  completed: "bg-green-50 text-green-700",
  in_progress: "bg-blue-50 text-blue-700",
  not_started: "bg-gray-50 text-gray-500",
  needs_retraining: "bg-red-50 text-red-600",
};

export default function TechProfileHeader({ tech, isSaving, onSave }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});

  const startEdit = () => {
    setForm({
      phone: tech?.phone || "",
      email: tech?.email || "",
      status: tech?.status || "active",
      specialty: tech?.specialty || "",
      market: tech?.market || "",
      equipment_types: tech?.equipment_types || [],
      notes: tech?.notes || "",
      employee_id: tech?.employee_id || "",
      contractor_id: tech?.contractor_id || "",
      project_manager: tech?.project_manager || "",
      training_status: tech?.training_status || "",
    });
    setEditing(true);
  };

  const handleSave = () => {
    onSave(form, () => setEditing(false));
  };

  const toggleEquipment = (item) => {
    setForm(f => {
      const arr = f.equipment_types || [];
      return { ...f, equipment_types: arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item] };
    });
  };

  const copyPhone = () => {
    if (tech?.phone) {
      navigator.clipboard.writeText(tech.phone);
      toast({ title: "Copied", description: "Phone number copied to clipboard." });
    }
  };

  const initials = (tech?.full_name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Color bar */}
      <div className="h-1.5 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700" />

      <div className="p-6">
        <div className="flex flex-col md:flex-row gap-5 justify-between">
          {/* Left: identity */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-md flex-shrink-0">
              <span className="text-white font-bold text-xl">{initials}</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900 leading-tight">{tech?.full_name}</h1>
                {tech?.status && (
                  <Badge className={`text-xs font-medium border ${STATUS_COLORS[tech.status] || ""}`}>
                    {tech.status.replace(/_/g, " ")}
                  </Badge>
                )}
                {tech?.training_status && (
                  <Badge className={`text-xs ${TRAINING_COLORS[tech.training_status] || "bg-gray-50 text-gray-500"}`}>
                    {tech.training_status.replace(/_/g, " ")}
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                {tech?.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{tech.phone}</span>
                  </span>
                )}
                {tech?.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{tech.email}</span>
                  </span>
                )}
                {tech?.market && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{tech.market}</span>
                  </span>
                )}
                {tech?.project_manager && (
                  <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                    PM: {tech.project_manager}
                  </span>
                )}
                {tech?.contractor_id && (
                  <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                    Contractor: {tech.contractor_id}
                  </span>
                )}
              </div>

              {(tech?.equipment_types || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {tech.equipment_types.map(e => (
                    <span key={e} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100 font-medium">{e}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-start gap-2 flex-wrap">
            {!editing ? (
              <>
                {tech?.phone && (
                  <>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={copyPhone}>
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copy #
                    </Button>
                    <a href={`tel:${tech.phone}`}>
                      <Button variant="outline" size="sm" className="h-8 text-xs text-green-700 border-green-200 hover:bg-green-50">
                        <PhoneCall className="w-3.5 h-3.5 mr-1" /> Call
                      </Button>
                    </a>
                  </>
                )}
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={startEdit}>
                  <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={isSaving}>
                  <Save className="w-3.5 h-3.5 mr-1" /> {isSaving ? "Saving…" : "Save"}
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setEditing(false)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Edit Form */}
        {editing && (
          <div className="mt-5 pt-5 border-t border-gray-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              {[
                { key: "phone", label: "Phone" },
                { key: "email", label: "Email" },
                { key: "market", label: "Market / Region" },
                { key: "employee_id", label: "Employee ID" },
                { key: "contractor_id", label: "Contractor ID" },
                { key: "project_manager", label: "Project Manager" },
                { key: "specialty", label: "Specialty" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-xs text-gray-400 font-medium block mb-1">{label}</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all"
                    value={form[key] || ""}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1">Status</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {["active", "on_leave", "inactive"].map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1">Training</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  value={form.training_status} onChange={e => setForm(f => ({ ...f, training_status: e.target.value }))}>
                  <option value="">— select —</option>
                  {["not_started", "in_progress", "completed", "needs_retraining"].map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 font-medium block mb-2">Equipment Types</label>
              <div className="flex flex-wrap gap-2">
                {EQUIPMENT_OPTIONS.map(opt => {
                  const selected = (form.equipment_types || []).includes(opt);
                  return (
                    <button key={opt} type="button" onClick={() => toggleEquipment(opt)}
                      className={`px-3 py-1 rounded-full text-xs border font-medium transition-all ${
                        selected ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "border-gray-200 text-gray-600 bg-white hover:border-blue-300 hover:text-blue-600"
                      }`}>
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}