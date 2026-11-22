
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { XCircle, Save, FileText, Loader2, UserPlus } from "lucide-react";
import { base44 } from "@/api/warrantyClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQueryClient } from "@tanstack/react-query";

export default function QCIssueForm({ qcIssue, technicians, onSubmit, onCancel, isLoading }) {
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState(qcIssue || {
    technician_id: "",
    technician_name: "",
    qc_notes: "",
    asset_number: "",
    make: "",
    model: "",
    year: "",
    install_service_date: new Date().toISOString().split('T')[0],
    installed_vin: "",
    asset_type: "",
    equip_vin: "",
    work_order_name: "",
    post_install_notes: "",
    case_number: "",
    warranty_return_required: false, // Added new field
    status: "pending_repair",
    repair_date: "",
    repair_notes: "",
    issue_category: "installation_quality"
  });

  const [emailText, setEmailText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [newTechCreated, setNewTechCreated] = useState(null);

  const parseEmail = async () => {
    if (!emailText.trim()) return;
    
    setParsing(true);
    setParseError("");
    setNewTechCreated(null);
    
    try {
      // First, extract the technician name and all QC data
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Parse this QC email and extract the following information. Return ONLY valid JSON with these exact fields:

Email text:
${emailText}

Extract and return this JSON structure (use null for missing values, use empty string "" if not found):
{
  "technician_name": "Extract the technician name from the greeting (e.g., 'Greetings John Doe' or 'Hello Jane Smith' or just find the name near the beginning of the email)",
  "qc_notes": "the Remote QC Notes section - extract the full text",
  "asset_number": "the Asset Number value",
  "make": "vehicle make value",
  "model": "vehicle model value", 
  "year": "vehicle year value",
  "install_service_date": "Install/Service Date in YYYY-MM-DD format",
  "installed_vin": "Installed VIN value",
  "equip_vin": "Equip VIN value",
  "work_order_name": "Work Order Name value",
  "post_install_notes": "Post Install Notes section - extract the full text",
  "case_number": "case number if mentioned (look for 'case number' in the text)",
  "asset_type": "Asset Type if mentioned",
  "warranty_return_required": "boolean - check if the subject line or anywhere in the email mentions 'warranty return required' or 'return required' or similar phrases. Return true if found, false otherwise"
}`,
        response_json_schema: {
          type: "object",
          properties: {
            technician_name: { type: "string" },
            qc_notes: { type: "string" },
            asset_number: { type: "string" },
            make: { type: "string" },
            model: { type: "string" },
            year: { type: "string" },
            install_service_date: { type: "string" },
            installed_vin: { type: "string" },
            equip_vin: { type: "string" },
            work_order_name: { type: "string" },
            post_install_notes: { type: "string" },
            case_number: { type: "string" },
            asset_type: { type: "string" },
            warranty_return_required: { type: "boolean" } // Added new field to schema
          },
          required: ["technician_name", "qc_notes", "install_service_date"]
        }
      });

      // Auto-detect issue category based on QC notes
      let category = "installation_quality";
      const notes = result.qc_notes?.toLowerCase() || "";
      if (notes.includes("camera")) category = "camera_positioning";
      else if (notes.includes("mirror")) category = "mirror_adjustment";
      else if (notes.includes("mount")) category = "mounting";
      else if (notes.includes("connection") || notes.includes("bugged")) category = "connection_issue";
      else if (notes.includes("missing") || notes.includes("not on vehicle")) category = "equipment_missing";

      // Check if technician exists, if not create them
      let technicianId = "";
      let technicianName = result.technician_name;
      
      if (result.technician_name) {
        // Find existing technician by name (case insensitive)
        const existingTech = technicians.find(
          t => t.full_name.toLowerCase() === result.technician_name.toLowerCase()
        );

        if (existingTech) {
          technicianId = existingTech.id;
          technicianName = existingTech.full_name;
        } else {
          // Create new technician
          const newTech = await base44.entities.Technician.create({
            full_name: result.technician_name,
            phone: "TBD",
            email: "",
            status: "active"
          });
          technicianId = newTech.id;
          technicianName = newTech.full_name;
          setNewTechCreated(result.technician_name);
          
          // Refresh technicians list without reloading page
          queryClient.invalidateQueries({ queryKey: ['technicians'] });
        }
      }

      // Update form with all parsed data
      setFormData({
        technician_id: technicianId,
        technician_name: technicianName,
        qc_notes: result.qc_notes || "",
        asset_number: result.asset_number || "",
        make: result.make || "",
        model: result.model || "",
        year: result.year || "",
        install_service_date: result.install_service_date || new Date().toISOString().split('T')[0],
        installed_vin: result.installed_vin || "",
        asset_type: result.asset_type || "",
        equip_vin: result.equip_vin || "",
        work_order_name: result.work_order_name || "",
        post_install_notes: result.post_install_notes || "",
        case_number: result.case_number || "",
        warranty_return_required: result.warranty_return_required || false, // Set new field value
        status: "pending_repair",
        repair_date: "",
        repair_notes: "",
        issue_category: category
      });
      
      setEmailText("");
    } catch (error) {
      console.error("Error parsing email:", error);
      setParseError("Failed to parse email. Please check the email format and try again.");
    }
    
    setParsing(false);
  };

  const handleTechChange = (techId) => {
    const tech = technicians.find(t => t.id === techId);
    setFormData({
      ...formData,
      technician_id: techId,
      technician_name: tech?.full_name || ""
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card className="material-card shadow-lg">
      <CardHeader className="bg-gradient-to-r from-red-500 to-orange-500 text-white">
        <CardTitle>{qcIssue ? 'Edit QC Issue' : 'New QC Issue'}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="p-6 space-y-4">
          {!qcIssue && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-blue-900 font-semibold">
                <FileText className="w-5 h-5" />
                <span>Quick Entry: Paste QC Email</span>
              </div>
              <Textarea
                value={emailText}
                onChange={(e) => setEmailText(e.target.value)}
                placeholder="Paste the entire QC email here (including subject line if it mentions warranty return) and click Parse Email to auto-fill the form..." // Updated placeholder
                rows={6}
                className="font-mono text-sm"
              />
              <Button
                type="button"
                onClick={parseEmail}
                disabled={!emailText.trim() || parsing}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {parsing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Parsing Email...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Parse Email & Auto-Fill Form
                  </>
                )}
              </Button>
              {newTechCreated && (
                <Alert className="bg-green-50 border-green-200">
                  <UserPlus className="w-4 h-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    New technician "{newTechCreated}" was automatically created and the form has been filled!
                  </AlertDescription>
                </Alert>
              )}
              {parseError && (
                <Alert variant="destructive">
                  <AlertDescription>{parseError}</AlertDescription>
                </Alert>
              )}
              <div className="border-t pt-3">
                <p className="text-sm text-gray-600">
                  💡 Tip: If the technician doesn't exist, they'll be automatically created!
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="technician">Technician *</Label>
              <Select
                value={formData.technician_id}
                onValueChange={handleTechChange}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select technician" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map(tech => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="install_service_date">Install/Service Date *</Label>
              <Input
                id="install_service_date"
                type="date"
                value={formData.install_service_date}
                onChange={(e) => setFormData({...formData, install_service_date: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="qc_notes">Remote QC Notes *</Label>
              <Textarea
                id="qc_notes"
                value={formData.qc_notes}
                onChange={(e) => setFormData({...formData, qc_notes: e.target.value})}
                required
                placeholder="Camera is too high as per the Spatco provided example image..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="work_order_name">Work Order Name</Label>
              <Input
                id="work_order_name"
                value={formData.work_order_name}
                onChange={(e) => setFormData({...formData, work_order_name: e.target.value})}
                placeholder="Motive: Spatco Energy - Dallas"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset_number">Asset Number</Label>
              <Input
                id="asset_number"
                value={formData.asset_number}
                onChange={(e) => setFormData({...formData, asset_number: e.target.value})}
                placeholder="2995"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="make">Make</Label>
              <Input
                id="make"
                value={formData.make}
                onChange={(e) => setFormData({...formData, make: e.target.value})}
                placeholder="Ford"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => setFormData({...formData, model: e.target.value})}
                placeholder="F-350"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                value={formData.year}
                onChange={(e) => setFormData({...formData, year: e.target.value})}
                placeholder="2024"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="installed_vin">Installed VIN</Label>
              <Input
                id="installed_vin"
                value={formData.installed_vin}
                onChange={(e) => setFormData({...formData, installed_vin: e.target.value})}
                placeholder="D38072"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="equip_vin">Equipment VIN</Label>
              <Input
                id="equip_vin"
                value={formData.equip_vin}
                onChange={(e) => setFormData({...formData, equip_vin: e.target.value})}
                placeholder="1FT8W3BA6PD380721FT8W3BA6PD38072"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset_type">Asset Type</Label>
              <Input
                id="asset_type"
                value={formData.asset_type}
                onChange={(e) => setFormData({...formData, asset_type: e.target.value})}
                placeholder="Vehicle type"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="case_number">Case Number</Label>
              <Input
                id="case_number"
                value={formData.case_number}
                onChange={(e) => setFormData({...formData, case_number: e.target.value})}
                placeholder="09869475"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="issue_category">Issue Category</Label>
              <Select
                value={formData.issue_category}
                onValueChange={(value) => setFormData({...formData, issue_category: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="camera_positioning">Camera Positioning</SelectItem>
                  <SelectItem value="mirror_adjustment">Mirror Adjustment</SelectItem>
                  <SelectItem value="mounting">Mounting</SelectItem>
                  <SelectItem value="connection_issue">Connection Issue</SelectItem>
                  <SelectItem value="equipment_missing">Equipment Missing</SelectItem>
                  <SelectItem value="installation_quality">Installation Quality</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({...formData, status: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending_repair">Pending Repair</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="repaired">Repaired</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* New Warranty Return Required Checkbox */}
            <div className="flex items-center space-x-2 pt-6">
              <input
                type="checkbox"
                id="warranty_return_required"
                checked={formData.warranty_return_required}
                onChange={(e) => setFormData({...formData, warranty_return_required: e.target.checked})}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <Label htmlFor="warranty_return_required" className="cursor-pointer font-medium">
                Warranty Return Required
              </Label>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="post_install_notes">Post Install Notes</Label>
              <Textarea
                id="post_install_notes"
                value={formData.post_install_notes}
                onChange={(e) => setFormData({...formData, post_install_notes: e.target.value})}
                placeholder="Asset number not on vehicle, connection is bugged..."
                rows={2}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="repair_notes">Repair Notes</Label>
              <Textarea
                id="repair_notes"
                value={formData.repair_notes}
                onChange={(e) => setFormData({...formData, repair_notes: e.target.value})}
                placeholder="How was this issue resolved?"
                rows={2}
              />
            </div>
            {formData.repair_notes && (
              <div className="space-y-2">
                <Label htmlFor="repair_date">Repair Date</Label>
                <Input
                  id="repair_date"
                  type="date"
                  value={formData.repair_date}
                  onChange={(e) => setFormData({...formData, repair_date: e.target.value})}
                />
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-3 border-t p-6">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="ripple"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 ripple"
          >
            <Save className="w-4 h-4 mr-2" />
            {qcIssue ? 'Update' : 'Create'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
