import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

const initialState = {
  data: [],
  status: "idle",
  error: null,
};

const NODE_ENV = process.env.NODE_ENV;
const urlFetch = NODE_ENV === "production" ? "" : "http://localhost:3000";

export const fetchCardsMaths = createAsyncThunk(
  "cardsMaths/fetchCardsMaths",
  async (arg, { rejectWithValue, getState }) => {
    try {
      const debugDelayMs = Number(
        arg?.debugDelayMs ?? process.env.NEXT_PUBLIC_DEBUG_CARDS_DELAY_MS ?? 0
      );
      if (NODE_ENV !== "production" && Number.isFinite(debugDelayMs) && debugDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, debugDelayMs));
      }

      const classId = getState()?.auth?.user?.classId;
      if (!classId) {
        return rejectWithValue("Aucune classe selectionnee.");
      }

      const response = await fetch(
        `${urlFetch}/cards?classId=${encodeURIComponent(classId)}`,
        {
          credentials: "include",
        }
      );
      const payload = await response.json();

      if (!response.ok) {
        return rejectWithValue(
          payload?.error || "Erreur lors du chargement des cartes."
        );
      }

      return { ...payload, __source: "public", __classId: classId };
    } catch (err) {
      return rejectWithValue("Erreur serveur.");
    }
  }
);

const cardsMathsSlice = createSlice({
  name: "cardsMaths",
  initialState,
  reducers: {
    setCardsMaths: (state, action) => {
      state.data = action.payload || null;
      if (
        !action.payload ||
        (Array.isArray(action.payload) && action.payload.length === 0)
      ) {
        state.status = "idle";
      } else {
        state.status = "succeeded";
      }
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCardsMaths.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchCardsMaths.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.data = action.payload || null;
        state.error = null;
      })
      .addCase(fetchCardsMaths.rejected, (state, action) => {
        state.status = "failed";
        state.error =
          action.payload || "Erreur lors du chargement des cartes.";
      });
  },
});

export const { setCardsMaths } = cardsMathsSlice.actions;
export default cardsMathsSlice.reducer;
