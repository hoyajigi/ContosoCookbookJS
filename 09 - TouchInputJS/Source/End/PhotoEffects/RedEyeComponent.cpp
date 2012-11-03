// RedEyeComponent.cpp
#include "pch.h"
#include "RedEyeComponent.h"

using namespace PhotoEffects;
using namespace Platform;
using namespace Windows::Foundation::Collections;

RedEyeComponent::RedEyeComponent()
{
}

IVector<unsigned char>^ RedEyeComponent::RemoveRedEye(IVector<unsigned char>^ pixels)
{
    // Loop through the pixels in the region, lowering red values that
    // exceed the sum of the blue and green values
	for (unsigned int i = 0; i < pixels->Size; i += 4)
    {
        unsigned char r = pixels->GetAt(i + 0);
        unsigned char g = pixels->GetAt(i + 1);
        unsigned char b = pixels->GetAt(i + 2);

        if (r > (g + b))
        {
            pixels->SetAt(i + 0, (unsigned char)((g + b) / 2));
        }
    }

    return pixels;
}
