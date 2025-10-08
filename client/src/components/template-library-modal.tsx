import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  Filter, 
  Palette, 
  Type, 
  Layout, 
  Star,
  Eye,
  Sparkles,
  Crown,
  Briefcase,
  Code,
  Paintbrush,
  Minimize2
} from 'lucide-react';
import { 
  resumeTemplates, 
  templateCategories, 
  getTemplatesByCategory, 
  searchTemplates,
  type ResumeTemplate 
} from '@/lib/templates';

interface TemplateLibraryModalProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (template: ResumeTemplate) => void;
  currentContent?: string;
}

export default function TemplateLibraryModal({ 
  open, 
  onClose, 
  onSelectTemplate,
  currentContent
}: TemplateLibraryModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [previewTemplate, setPreviewTemplate] = useState<ResumeTemplate | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'difficulty' | 'category'>('name');

  // Filter and sort templates
  const filteredTemplates = (() => {
    let templates = searchQuery 
      ? searchTemplates(searchQuery)
      : selectedCategory === 'all' 
      ? resumeTemplates 
      : getTemplatesByCategory(selectedCategory);

    // Sort templates
    return templates.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'difficulty':
          const difficultyOrder = { beginner: 1, intermediate: 2, advanced: 3 };
          return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
        case 'category':
          return a.category.localeCompare(b.category);
        default:
          return 0;
      }
    });
  })();

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'modern': return <Sparkles className="mr-2" size={16} />;
      case 'classic': return <Crown className="mr-2" size={16} />;
      case 'creative': return <Paintbrush className="mr-2" size={16} />;
      case 'minimal': return <Minimize2 className="mr-2" size={16} />;
      case 'executive': return <Briefcase className="mr-2" size={16} />;
      default: return <Layout className="mr-2" size={16} />;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleSelectTemplate = (template: ResumeTemplate) => {
    onSelectTemplate(template);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center text-xl font-semibold">
            <Palette className="mr-2" size={24} />
            Professional Template Library
            <Badge className="ml-2 bg-blue-100 text-blue-800">
              {filteredTemplates.length} Templates
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col h-[calc(95vh-120px)]">
          {/* Search and Filter Bar */}
          <div className="flex items-center space-x-4 p-4 border-b border-border">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                placeholder="Search templates by name, style, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Filter size={16} className="text-muted-foreground" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="name">Sort by Name</option>
                <option value="difficulty">Sort by Difficulty</option>
                <option value="category">Sort by Category</option>
              </select>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Category Sidebar */}
            <div className="w-64 p-4 border-r border-border">
              <h3 className="font-semibold mb-3 text-foreground">Categories</h3>
              <div className="space-y-2">
                <Button
                  variant={selectedCategory === 'all' ? 'default' : 'ghost'}
                  className="w-full justify-start"
                  onClick={() => setSelectedCategory('all')}
                >
                  <Layout className="mr-2" size={16} />
                  All Templates ({resumeTemplates.length})
                </Button>
                
                {templateCategories.map((category) => {
                  const count = getTemplatesByCategory(category.id).length;
                  return (
                    <Button
                      key={category.id}
                      variant={selectedCategory === category.id ? 'default' : 'ghost'}
                      className="w-full justify-start"
                      onClick={() => setSelectedCategory(category.id)}
                    >
                      {getCategoryIcon(category.id)}
                      {category.name} ({count})
                    </Button>
                  );
                })}
              </div>

              {/* Quick Stats */}
              <div className="mt-6 p-3 bg-muted/30 rounded-lg">
                <h4 className="font-medium text-sm mb-2">Quick Stats</h4>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>Total: {resumeTemplates.length} templates</div>
                  <div>Beginner-friendly: {resumeTemplates.filter(t => t.difficulty === 'beginner').length}</div>
                  <div>ATS-optimized: {resumeTemplates.filter(t => t.tags.includes('ats-friendly')).length}</div>
                </div>
              </div>
            </div>

            {/* Template Grid */}
            <div className="flex-1 p-4">
              <ScrollArea className="h-full">
                {filteredTemplates.length === 0 ? (
                  <div className="flex items-center justify-center h-64 text-muted-foreground">
                    <div className="text-center">
                      <Search className="mx-auto mb-2" size={48} />
                      <p>No templates found matching your criteria</p>
                      <p className="text-sm">Try adjusting your search or filters</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTemplates.map((template) => (
                      <Card 
                        key={template.id} 
                        className="cursor-pointer transition-all hover:shadow-md hover:scale-105 group"
                        onClick={() => setPreviewTemplate(template)}
                      >
                        <CardContent className="p-4">
                          {/* Template Preview */}
                          <div 
                            className="h-32 mb-3 rounded-lg border-2 border-dashed border-border flex items-center justify-center relative overflow-hidden"
                            style={{ 
                              background: `linear-gradient(135deg, ${template.colorScheme.primary}15, ${template.colorScheme.accent}15)`
                            }}
                          >
                            {/* Mini preview content */}
                            <div className="text-center transform scale-50 opacity-60 group-hover:opacity-80 transition-opacity">
                              <div 
                                className="w-24 h-2 mb-1 rounded"
                                style={{ backgroundColor: template.colorScheme.primary }}
                              ></div>
                              <div 
                                className="w-16 h-1 mb-2 rounded"
                                style={{ backgroundColor: template.colorScheme.text }}
                              ></div>
                              <div className="space-y-1">
                                <div className="w-20 h-1 bg-gray-300 rounded"></div>
                                <div className="w-18 h-1 bg-gray-300 rounded"></div>
                                <div className="w-16 h-1 bg-gray-300 rounded"></div>
                              </div>
                            </div>
                            
                            {/* Overlay */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <Eye className="text-white" size={20} />
                            </div>
                          </div>

                          {/* Template Info */}
                          <div className="space-y-2">
                            <div className="flex items-start justify-between">
                              <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                                {template.name}
                              </h3>
                              {template.tags.includes('popular') && (
                                <Star className="text-yellow-500 fill-current" size={14} />
                              )}
                            </div>
                            
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {template.description}
                            </p>

                            {/* Tags */}
                            <div className="flex flex-wrap gap-1 mt-2">
                              <Badge 
                                className={`text-xs ${getDifficultyColor(template.difficulty)}`}
                              >
                                {template.difficulty}
                              </Badge>
                              <Badge 
                                className="text-xs bg-gray-100 text-gray-700"
                                style={{ 
                                  backgroundColor: `${template.colorScheme.primary}20`,
                                  color: template.colorScheme.primary 
                                }}
                              >
                                {template.category}
                              </Badge>
                            </div>

                            {/* Template Tags */}
                            <div className="flex flex-wrap gap-1 mt-1">
                              {template.tags.slice(0, 2).map((tag, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {template.tags.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{template.tags.length - 2}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </div>

        {/* Template Preview Modal */}
        <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
          <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden">
            {previewTemplate && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                      {getCategoryIcon(previewTemplate.category)}
                      {previewTemplate.name}
                      <Badge className={`ml-2 ${getDifficultyColor(previewTemplate.difficulty)}`}>
                        {previewTemplate.difficulty}
                      </Badge>
                    </div>
                  </DialogTitle>
                  <p className="text-muted-foreground">{previewTemplate.description}</p>
                </DialogHeader>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(95vh-200px)]">
                  {/* Preview */}
                  <div className="lg:col-span-2">
                    <div className="h-full border rounded-lg overflow-hidden">
                      <div className="h-full overflow-y-auto p-4 bg-white">
                        <div 
                          className="transform scale-75 origin-top-left w-[133%]"
                          dangerouslySetInnerHTML={{ 
                            __html: previewTemplate.generateContent() 
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Template Details */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Template Features</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center">
                          <Layout className="mr-2" size={14} />
                          {previewTemplate.layout.columns} column layout
                        </div>
                        <div className="flex items-center">
                          <Type className="mr-2" size={14} />
                          {previewTemplate.typography.headings} headings
                        </div>
                        <div className="flex items-center">
                          <Palette className="mr-2" size={14} />
                          Professional color scheme
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Best For</h3>
                      <div className="flex flex-wrap gap-1">
                        {previewTemplate.tags.map((tag, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Color Palette</h3>
                      <div className="flex space-x-2">
                        {Object.values(previewTemplate.colorScheme).slice(0, 4).map((color, index) => (
                          <div
                            key={index}
                            className="w-8 h-8 rounded-full border"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>

                    {currentContent && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800">
                          ⚠️ Applying this template will replace your current resume content. 
                          Make sure to save any important changes first.
                        </p>
                      </div>
                    )}

                    <div className="flex space-x-2">
                      <Button
                        onClick={() => handleSelectTemplate(previewTemplate)}
                        className="flex-1"
                      >
                        Use This Template
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setPreviewTemplate(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}