import { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileSelect: (content: string, fileName: string) => void;
  isLoading: boolean;
}

export function FileUpload({ onFileSelect, isLoading }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    setError(null);
    
    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
      setError('Please upload an HTML file (.html or .htm)');
      return;
    }
    
    if (file.size > 50 * 1024 * 1024) {
      setError('File size exceeds 50MB limit');
      return;
    }
    
    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      onFileSelect(content, file.name);
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  }, [onFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  return (
    <Card 
      className={cn(
        "border-2 border-dashed transition-all duration-300",
        isDragging ? "border-primary bg-primary/5 scale-[1.02]" : "border-border hover:border-primary/50",
        isLoading && "opacity-50 pointer-events-none"
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <CardContent className="flex flex-col items-center justify-center py-16 px-8">
        <div className={cn(
          "rounded-full p-6 mb-6 transition-colors",
          isDragging ? "bg-primary/20" : "bg-muted"
        )}>
          {fileName ? (
            <FileText className="h-12 w-12 text-primary" />
          ) : (
            <Upload className={cn(
              "h-12 w-12 transition-colors",
              isDragging ? "text-primary" : "text-muted-foreground"
            )} />
          )}
        </div>
        
        {fileName ? (
          <div className="text-center mb-4">
            <p className="text-lg font-medium">{fileName}</p>
            <p className="text-sm text-muted-foreground mt-1">Ready for analysis</p>
          </div>
        ) : (
          <>
            <h3 className="text-xl font-semibold mb-2">
              {isDragging ? 'Drop your file here' : 'Upload Spark Extent Report'}
            </h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Drag and drop your HTML report file here, or click to browse.
              Supports Spark Extent Reports from TestNG, JUnit, and Cucumber.
            </p>
          </>
        )}
        
        <input
          type="file"
          accept=".html,.htm"
          onChange={handleInputChange}
          className="hidden"
          id="file-upload"
          disabled={isLoading}
        />
        
        <Button asChild variant={fileName ? "outline" : "default"} size="lg" disabled={isLoading}>
          <label htmlFor="file-upload" className="cursor-pointer">
            {fileName ? 'Choose Different File' : 'Select File'}
          </label>
        </Button>
        
        {error && (
          <div className="flex items-center gap-2 mt-4 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}
        
        <p className="text-xs text-muted-foreground mt-6">
          Maximum file size: 50MB • Supported: .html, .htm
        </p>
      </CardContent>
    </Card>
  );
}
