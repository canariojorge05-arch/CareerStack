import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

export function useProcessTechStackMutation(resumeId: string, input: string, previewStats: { totalPoints: number; totalTechs: number }, onSuccess: (data: any) => void) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/resumes/${resumeId}/process-tech-stack`, { input });
      return response.json();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["/api/resumes"] });
      const previousResumes = queryClient.getQueryData(["/api/resumes"]);
      queryClient.setQueryData(["/api/resumes"], (old: any) =>
        old?.map((resume: any) =>
          resume.id === resumeId
            ? { ...resume, status: "processing" }
            : resume
        ) || []
      );
      toast({
        title: "⚡ Lightning Processing!",
        description: "Processing tech stack at ultra-fast speed...",
      });
      return { previousResumes };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/resumes"], (old: any) =>
        old?.map((resume: any) =>
          resume.id === resumeId
            ? { ...resume, status: "ready" }
            : resume
        ) || []
      );
      queryClient.invalidateQueries({ queryKey: ["/api/resumes"] });
      toast({
        title: "🚀 Smart Processing Complete!",
        description: `Generated ${data.groups?.length || 0} balanced groups from ${previewStats.totalPoints} points! Processed ${previewStats.totalTechs} tech stacks in record time.`,
        duration: 5000,
      });
      onSuccess(data);
    },
    onError: (error, variables, context) => {
      if (context?.previousResumes) {
        queryClient.setQueryData(["/api/resumes"], context.previousResumes);
      }
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Processing Failed",
        description: error.message || "Failed to process tech stack",
        variant: "destructive",
      });
    },
  });
}
