import { useState } from "react";
import { ShoppingBag, Upload, FileText, Settings, ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Document,
  DocumentUploadForm, 
  DocumentViewer,
  MarketplaceBrowse,
  UserDocuments,
  AdminDocumentReview
} from "@/components/marketplace";

const ADMIN_EMAIL = "ogunseun7@gmail.com";

export default function Marketplace() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("browse");
  const [viewingDocument, setViewingDocument] = useState<Document | null>(null);

  const isAdmin = user?.email === ADMIN_EMAIL;

  const handleViewDocument = (doc: Document) => {
    setViewingDocument(doc);
  };

  const handleDownload = (doc: Document) => {
    window.open(doc.file_url, '_blank');
  };

  const handleBackFromViewer = () => {
    setViewingDocument(null);
  };

  // If viewing a document, show the viewer
  if (viewingDocument) {
    return (
      <div className="h-full bg-background overflow-hidden">
        <DocumentViewer
          document={viewingDocument}
          onBack={handleBackFromViewer}
          onDownload={handleDownload}
          previewOnly={viewingDocument.page_count > 5}
        />
      </div>
    );
  }

  return (
    <div className="h-full bg-background overflow-y-auto">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary" />
            Document Marketplace
          </h1>
          <p className="text-muted-foreground">
            Browse, share, and download free legal documents and templates
          </p>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-4' : 'grid-cols-3'}`}>
            <TabsTrigger value="browse" className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">Browse</span>
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Upload</span>
            </TabsTrigger>
            <TabsTrigger value="my-docs" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">My Documents</span>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="admin" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Admin</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* Browse Tab */}
          <TabsContent value="browse" className="mt-6">
            <MarketplaceBrowse onViewDocument={handleViewDocument} />
          </TabsContent>

          {/* Upload Tab */}
          <TabsContent value="upload" className="mt-6">
            <DocumentUploadForm 
              onSuccess={() => setActiveTab("my-docs")} 
            />
          </TabsContent>

          {/* My Documents Tab */}
          <TabsContent value="my-docs" className="mt-6">
            <UserDocuments 
              onView={handleViewDocument}
            />
          </TabsContent>

          {/* Admin Tab */}
          {isAdmin && (
            <TabsContent value="admin" className="mt-6">
              <AdminDocumentReview />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
